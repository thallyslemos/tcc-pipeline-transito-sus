"""Cliente de integracao com as APIs do IBGE.

Responsavel por:
- Buscar lista de municipios (localidades)
- Buscar malhas GeoJSON para calcular centroid (lat/lon)
- Buscar populacao estimada (SIDRA Tabela 6579)
- Persistir dados em Parquet para uso pelo Gold/Backend
"""

from __future__ import annotations

from collections.abc import Iterable
from dataclasses import dataclass
from pathlib import Path

import duckdb
import httpx
import pandas as pd

from .config import settings
from .logging import get_logger

logger = get_logger(__name__)

LOCALIDADES_URL = "https://servicodados.ibge.gov.br/api/v1/localidades/municipios"
MALHA_UF_URL = (
    "https://servicodados.ibge.gov.br/api/v3/malhas/estados/{uf}/municipios"
)
SIDRA_BASE_URL = "https://apisidra.ibge.gov.br/values"
SIDRA_TABELA = "6579"
SIDRA_VARIAVEL_POP = "9324"


@dataclass(frozen=True)
class MunicipioLocalidade:
    cod_mun_ibge: str
    nome: str
    uf: str
    regiao: str


def _http_get(url: str, *, params: dict | None = None, timeout: float = 30.0) -> httpx.Response:
    """Wrapper simples de GET com log e timeout padrao."""
    try:
        resp = httpx.get(url, params=params, timeout=timeout)
        resp.raise_for_status()
        return resp
    except httpx.HTTPError as exc:
        logger.error("ibge_http_erro", url=url, params=params, erro=str(exc))
        raise


def fetch_localidades() -> list[MunicipioLocalidade]:
    """Busca lista completa de municipios na API de localidades."""
    logger.info("ibge_localidades_busca", url=LOCALIDADES_URL)
    resp = _http_get(LOCALIDADES_URL)
    data = resp.json()

    municipios: list[MunicipioLocalidade] = []
    for item in data:
        try:
            cod = str(item["id"])
            nome = item["nome"]
            uf_info = item["microrregiao"]["mesorregiao"]["UF"]
            uf_sigla = uf_info["sigla"]
            regiao_nome = uf_info["regiao"]["nome"]
            municipios.append(
                MunicipioLocalidade(
                    cod_mun_ibge=cod,
                    nome=nome,
                    uf=uf_sigla,
                    regiao=regiao_nome,
                )
            )
        except Exception as exc:  # pragma: no cover - defensivo
            logger.warning("ibge_localidade_parse_falha", erro=str(exc), raw=item)
            continue

    logger.info("ibge_localidades_total", total=len(municipios))
    return municipios


def _iter_coords(obj) -> Iterable[tuple[float, float]]:
    """Itera recursivamente por todas as coordenadas [lon, lat] em um GeoJSON."""
    if isinstance(obj, (list, tuple)):
        if (
            len(obj) == 2
            and all(isinstance(x, (int, float)) for x in obj)
        ):
            # Coordenada [lon, lat]
            yield float(obj[0]), float(obj[1])
        else:
            for child in obj:
                yield from _iter_coords(child)


def fetch_malha_municipios(uf: str) -> dict[str, dict[str, float]]:
    """Busca malha GeoJSON para uma UF e calcula centroid por municipio.

    Retorna dict {cod_mun_ibge: {\"lat\": float, \"lon\": float}}.
    """
    url = MALHA_UF_URL.format(uf=uf)
    params = {"formato": "application/vnd.geo+json"}
    logger.info("ibge_malha_busca", uf=uf, url=url)
    try:
        resp = _http_get(url, params=params, timeout=60.0)
    except httpx.HTTPError:
        # Ja logado em _http_get
        return {}

    data = resp.json()
    features = data.get("features", [])

    coords_por_mun: dict[str, dict[str, float]] = {}
    for feat in features:
        props = feat.get("properties", {}) or {}
        cod = str(props.get("codarea") or props.get("id") or feat.get("id") or "")
        if not cod:
            continue

        geom = feat.get("geometry") or {}
        coords = list(_iter_coords(geom.get("coordinates")))
        if not coords:
            continue

        # Centroid aproximado: media simples das coordenadas
        lons = [c[0] for c in coords]
        lats = [c[1] for c in coords]
        lon_c = sum(lons) / len(lons)
        lat_c = sum(lats) / len(lats)
        coords_por_mun[cod] = {"lat": lat_c, "lon": lon_c}

    logger.info("ibge_malha_processada", uf=uf, municipios=len(coords_por_mun))
    return coords_por_mun


def fetch_populacao(cod_mun: str, ano: int) -> int | None:
    """Busca populacao estimada para um municipio/ano (SIDRA Tabela 6579)."""
    url = (
        f"{SIDRA_BASE_URL}/t/{SIDRA_TABELA}/n6/{cod_mun}/"
        f"v/{SIDRA_VARIAVEL_POP}/p/{ano}"
    )
    params = {"formato": "json"}
    logger.info("ibge_sidra_busca", cod_mun=cod_mun, ano=ano, url=url)
    try:
        resp = _http_get(url, params=params, timeout=60.0)
    except httpx.HTTPError:
        return None

    try:
        data = resp.json()
    except ValueError as exc:  # pragma: no cover - defensivo
        logger.warning("ibge_sidra_json_invalido", erro=str(exc))
        return None

    # API retorna primeira linha como cabecalho e as demais como dados
    if not isinstance(data, list) or len(data) < 2:
        return None

    for item in data[1:]:
        valor = item.get("V")
        if not valor:
            continue
        try:
            # Valor vem como string, ex: "2480790"
            v = int(str(valor).replace(".", "").replace(",", ""))
            return v
        except (TypeError, ValueError):  # pragma: no cover - defensivo
            logger.warning("ibge_sidra_valor_invalido", raw_valor=valor)
            continue

    return None


def _silver_paths() -> tuple[Path, Path]:
    """Retorna caminhos esperados dos Parquet Silver."""
    sim = settings.resolve(settings.silver_dir) / "sim.parquet"
    sia = settings.resolve(settings.silver_dir) / "sia.parquet"
    return sim, sia


def _infer_cod_ano_uf() -> list[tuple[str, int, str]]:
    """Infere combinacoes (cod_mun_ibge, ano, uf) a partir dos Silver."""
    silver_sim, silver_sia = _silver_paths()
    combos: set[tuple[str, int, str]] = set()

    con = duckdb.connect(":memory:")
    try:
        if silver_sim.exists():
            df_sim = con.sql(
                f"""
                SELECT DISTINCT
                    CAST(cod_mun_ocorrencia AS VARCHAR) AS cod_mun_ibge,
                    YEAR(competencia) AS ano,
                    uf
                FROM read_parquet('{silver_sim}')
                """
            ).fetchdf()
            for _, row in df_sim.iterrows():
                combos.add((row["cod_mun_ibge"], int(row["ano"]), row["uf"]))

        if silver_sia.exists():
            df_sia = con.sql(
                f"""
                SELECT DISTINCT
                    CAST(cod_mun AS VARCHAR) AS cod_mun_ibge,
                    YEAR(competencia) AS ano,
                    uf
                FROM read_parquet('{silver_sia}')
                """
            ).fetchdf()
            for _, row in df_sia.iterrows():
                combos.add((row["cod_mun_ibge"], int(row["ano"]), row["uf"]))
    finally:
        con.close()

    return sorted(combos, key=lambda t: (t[0], t[1]))


def _write_parquet(df: pd.DataFrame, path: Path) -> None:
    """Grava DataFrame em Parquet usando DuckDB (evita dependencia extra)."""
    if df.empty:
        logger.warning("ibge_parquet_vazio", path=str(path))
    path.parent.mkdir(parents=True, exist_ok=True)
    con = duckdb.connect(":memory:")
    try:
        con.register("t", df)
        con.sql(f"COPY t TO '{path}' (FORMAT PARQUET)")
    finally:
        con.close()


def salvar_ibge_parquet(dest_dir: Path | None = None) -> None:
    """Orquestra busca de dados IBGE e salva em Parquet.

    Args:
        dest_dir: Diretório base para os arquivos Parquet IBGE.
                  Se None, usa settings.data_dir.
    """
    dest_dir = settings.resolve(settings.data_dir) if dest_dir is None else Path(dest_dir)

    logger.info("ibge_parquet_iniciando", dest_dir=str(dest_dir))

    combos = _infer_cod_ano_uf()
    if not combos:
        logger.warning("ibge_sem_combos_silver", msg="Nenhum municipio/ano encontrado no Silver")
        return

    codigos = sorted({c for (c, _, _) in combos})
    anos = sorted({a for (_, a, _) in combos})
    ufs = sorted({u for (_, _, u) in combos})

    logger.info(
        "ibge_combos_inferidos",
        municipios=len(codigos),
        anos=anos,
        ufs=ufs,
    )

    # 1) Localidades (nome, uf, regiao)
    localidades = fetch_localidades()
    loc_map: dict[str, MunicipioLocalidade] = {
        m.cod_mun_ibge: m for m in localidades if m.cod_mun_ibge in codigos
    }

    # 2) Malhas (lat/lon por UF)
    coords_map: dict[str, dict[str, float]] = {}
    for uf in ufs:
        coords_uf = fetch_malha_municipios(uf)
        coords_map.update(coords_uf)

    municipios_rows: list[dict] = []
    for cod in codigos:
        loc = loc_map.get(cod)
        if not loc:
            # Municipio aparece nos dados mas nao retornou na API de localidades
            logger.warning("ibge_municipio_sem_localidade", cod_mun_ibge=cod)
            continue
        coords = coords_map.get(cod, {})
        municipios_rows.append(
            {
                "cod_mun_ibge": loc.cod_mun_ibge,
                "nome": loc.nome,
                "uf": loc.uf,
                "regiao": loc.regiao,
                "lat": coords.get("lat"),
                "lon": coords.get("lon"),
            }
        )

    df_mun = pd.DataFrame(municipios_rows)
    municipios_path = dest_dir / "ibge_municipios.parquet"
    _write_parquet(df_mun, municipios_path)
    logger.info("ibge_municipios_salvo", path=str(municipios_path), registros=len(df_mun))

    # 3) Populacao (cod, ano -> populacao)
    pop_rows: list[dict] = []
    for cod, ano, _uf in combos:
        pop = fetch_populacao(cod, ano)
        if not pop:
            logger.warning("ibge_populacao_indisponivel", cod_mun_ibge=cod, ano=ano)
            continue
        pop_rows.append(
            {
                "cod_mun_ibge": cod,
                "ano": ano,
                "populacao": int(pop),
            }
        )

    df_pop = pd.DataFrame(pop_rows)
    pop_path = dest_dir / "ibge_populacao.parquet"
    _write_parquet(df_pop, pop_path)
    logger.info("ibge_populacao_salvo", path=str(pop_path), registros=len(df_pop))

