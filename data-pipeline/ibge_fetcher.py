"""Cliente de integracao com as APIs do IBGE.

Responsavel por:
- Buscar lista de municipios (localidades)
- Buscar malhas GeoJSON para calcular centroid (lat/lon)
- Buscar populacao estimada (SIDRA Tabela 6579)
- Persistir dados em Parquet para uso pelo Gold/Backend
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import duckdb
import httpx
import pandas as pd

from .config import settings
from .logging import get_logger

logger = get_logger(__name__)

LOCALIDADES_URL = "https://servicodados.ibge.gov.br/api/v1/localidades/municipios"
METADADOS_MUN_URL = (
    "https://servicodados.ibge.gov.br/api/v4/malhas/municipios/{cod}/metadados"
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
            micro = item.get("microrregiao")
            regiao_imediata = item.get("regiao-imediata")
            if micro and micro.get("mesorregiao"):
                uf_info = micro["mesorregiao"]["UF"]
            elif regiao_imediata and regiao_imediata.get("regiao-intermediaria"):
                uf_info = regiao_imediata["regiao-intermediaria"]["UF"]
            else:
                continue
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


def fetch_centroide_municipio(cod_mun: str) -> dict[str, float] | None:
    """Busca centroide de um municipio via API v4 de metadados de malhas.

    URL: /api/v4/malhas/municipios/{cod}/metadados
    Retorna: {"lat": float, "lon": float} ou None.
    """
    url = METADADOS_MUN_URL.format(cod=cod_mun)
    try:
        resp = _http_get(url, timeout=15.0)
    except httpx.HTTPError:
        return None

    try:
        data = resp.json()
    except ValueError:
        return None

    if isinstance(data, list) and data:
        centroide = data[0].get("centroide", {})
        lat = centroide.get("latitude")
        lon = centroide.get("longitude")
        if lat is not None and lon is not None:
            return {"lat": float(lat), "lon": float(lon)}
    return None


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
                    TRIM(CAST(cod_mun_ocorrencia AS VARCHAR)) AS cod_mun_ibge,
                    YEAR(competencia) AS ano,
                    TRIM(CAST(uf AS VARCHAR)) AS uf
                FROM read_parquet('{silver_sim}')
                """
            ).fetchdf()
            for _, row in df_sim.iterrows():
                combos.add((row["cod_mun_ibge"].strip(), int(row["ano"]), row["uf"]))

        if silver_sia.exists():
            df_sia = con.sql(
                f"""
                SELECT DISTINCT
                    TRIM(CAST(cod_mun AS VARCHAR)) AS cod_mun_ibge,
                    YEAR(competencia) AS ano,
                    TRIM(CAST(uf AS VARCHAR)) AS uf
                FROM read_parquet('{silver_sia}')
                """
            ).fetchdf()
            for _, row in df_sia.iterrows():
                combos.add((row["cod_mun_ibge"].strip(), int(row["ano"]), row["uf"]))
    finally:
        con.close()

    return sorted(combos, key=lambda t: (t[0], t[1]))


def _write_parquet(df: pd.DataFrame, path: Path) -> None:
    """Grava DataFrame em Parquet usando DuckDB (evita dependencia extra)."""
    path.parent.mkdir(parents=True, exist_ok=True)
    if df.empty:
        logger.warning("ibge_parquet_vazio", path=str(path))
        return
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

    # Mapa por código de 7 dígitos (IBGE oficial) e por prefixo de 6 dígitos
    # (DATASUS/SIA). Permite lookup com ambos os formatos.
    loc_map_7: dict[str, MunicipioLocalidade] = {m.cod_mun_ibge: m for m in localidades}
    loc_map_6: dict[str, MunicipioLocalidade] = {m.cod_mun_ibge[:6]: m for m in localidades}

    def _find_localidade(cod: str) -> MunicipioLocalidade | None:
        if cod in loc_map_7:
            return loc_map_7[cod]
        prefix = cod[:6]
        if prefix in loc_map_6:
            return loc_map_6[prefix]
        return None

    # 2) Centroides (lat/lon) via API v4 metadados — por municipio
    # Deduplica por prefixo de 6 dígitos para evitar duplicatas no JOIN
    seen_prefixes: set[str] = set()
    municipios_rows: list[dict] = []
    for cod in codigos:
        loc = _find_localidade(cod)
        if not loc:
            logger.warning("ibge_municipio_sem_localidade", cod_mun_ibge=cod)
            continue
        prefix = loc.cod_mun_ibge[:6]
        if prefix in seen_prefixes:
            continue
        seen_prefixes.add(prefix)
        coords = fetch_centroide_municipio(loc.cod_mun_ibge) or {}
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
    # API SIDRA requer código de 7 dígitos. Mapeamos cod→cod_ibge_7.
    pop_rows: list[dict] = []
    seen_pop: set[tuple[str, int]] = set()
    for cod, ano, _uf in combos:
        loc = _find_localidade(cod)
        cod_7 = loc.cod_mun_ibge if loc else cod
        prefix_ano = (cod_7[:6], ano)
        if prefix_ano in seen_pop:
            continue
        seen_pop.add(prefix_ano)
        pop = fetch_populacao(cod_7, ano)
        if not pop:
            logger.warning("ibge_populacao_indisponivel", cod_mun_ibge=cod_7, ano=ano)
            continue
        pop_rows.append(
            {
                "cod_mun_ibge": cod_7,
                "ano": ano,
                "populacao": int(pop),
            }
        )

    df_pop = pd.DataFrame(pop_rows)
    pop_path = dest_dir / "ibge_populacao.parquet"
    _write_parquet(df_pop, pop_path)
    logger.info("ibge_populacao_salvo", path=str(pop_path), registros=len(df_pop))

