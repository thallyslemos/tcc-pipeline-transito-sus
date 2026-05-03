"""Cliente de integracao com as APIs do IBGE.

Responsavel por:
- Buscar lista de municipios (localidades)
- Buscar malhas GeoJSON para calcular centroid (lat/lon)
- Buscar populacao estimada (SIDRA Tabela 6579)
- Persistir dados em Parquet para uso pelo Gold/Backend
"""

from __future__ import annotations

import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from pathlib import Path

import duckdb
import httpx
import pandas as pd

from .config import settings
from .logging import get_logger

logger = get_logger(__name__)
1100700
LOCALIDADES_URL = "https://servicodados.ibge.gov.br/api/v1/localidades/municipios"
METADADOS_MUN_URL = (
    "https://servicodados.ibge.gov.br/api/v4/malhas/municipios/1100700/metadados"
)
MALHAS_BR_URL = (
    "https://servicodados.ibge.gov.br/api/v4/malhas/paises/BR"
    "?formato=application/vnd.geo+json&qualidade=minima&intrarregiao=municipio"
)
SIDRA_BASE_URL = "https://apisidra.ibge.gov.br/values"
SIDRA_TABELA = "6579"
SIDRA_VARIAVEL_POP = "9324"
MAX_WORKERS = 10  # Limita o número de threads para não sobrecarregar a API


@dataclass(frozen=True)
class MunicipioLocalidade:
    cod_mun_ibge: str
    nome: str
    uf: str
    regiao: str


def _http_get_with_retry(
    url: str, *, params: dict | None = None, timeout: float = 30.0, retries: int = 3, delay: float = 1.0
) -> httpx.Response | None:
    """Wrapper GET com retries e exponential backoff."""
    for attempt in range(retries):
        try:
            resp = httpx.get(url, params=params, timeout=timeout)
            resp.raise_for_status()
            return resp
        except httpx.HTTPError as exc:
            logger.warning("ibge_http_erro", url=url, attempt=attempt + 1, erro=str(exc))
            if attempt + 1 == retries:
                logger.error("ibge_http_falha_final", url=url, erro=str(exc))
                return None
            time.sleep(delay * (2**attempt))
    return None


def fetch_localidades() -> list[MunicipioLocalidade]:
    """Busca lista completa de municipios na API de localidades."""
    logger.info("ibge_localidades_busca", url=LOCALIDADES_URL)
    resp = _http_get_with_retry(LOCALIDADES_URL)
    if not resp:
        return []
        
    data = resp.json()
    municipios: list[MunicipioLocalidade] = []
    for item in data:
        try:
            cod = str(item["id"])
            nome = item["nome"]
            uf_info = item.get("regiao-imediata", {}).get("regiao-intermediaria", {}).get("UF", {})
            uf_sigla = uf_info.get("sigla")
            regiao_nome = uf_info.get("regiao", {}).get("nome")
            if uf_sigla and regiao_nome:
                municipios.append(
                    MunicipioLocalidade(
                        cod_mun_ibge=cod, nome=nome, uf=uf_sigla, regiao=regiao_nome
                    )
                )
        except Exception as exc:
            logger.warning("ibge_localidade_parse_falha", erro=str(exc), raw=item)
            continue
    logger.info("ibge_localidades_total", total=len(municipios))
    return municipios


def fetch_centroide_municipio(cod_mun: str) -> tuple[str, dict[str, float] | None]:
    """Busca centroide de um municipio. Retorna tupla (cod_mun, resultado)."""
    url = METADADOS_MUN_URL.format(cod=cod_mun)
    resp = _http_get_with_retry(url, timeout=15.0)
    if not resp:
        return cod_mun, None

    try:
        data = resp.json()
        if isinstance(data, list) and data:
            centroide = data[0].get("centroide", {})
            lat = centroide.get("latitude")
            lon = centroide.get("longitude")
            if lat is not None and lon is not None:
                return cod_mun, {"lat": float(lat), "lon": float(lon)}
    except (ValueError, IndexError):
        return cod_mun, None
    return cod_mun, None


def fetch_populacao(cod_mun: str, ano: int) -> tuple[str, int, int | None]:
    """Busca populacao estimada. Retorna tupla (cod_mun, ano, resultado)."""
    url = f"{SIDRA_BASE_URL}/t/{SIDRA_TABELA}/n6/{cod_mun}/v/{SIDRA_VARIAVEL_POP}/p/{ano}"
    params = {"formato": "json"}
    logger.info("ibge_sidra_busca", cod_mun=cod_mun, ano=ano)
    
    resp = _http_get_with_retry(url, params=params, timeout=60.0)
    if not resp:
        return cod_mun, ano, None

    try:
        data = resp.json()
        if not isinstance(data, list) or len(data) < 2:
            return cod_mun, ano, None
        
        valor = data[1].get("V")
        if valor and str(valor).strip() not in ("..", "...", "-"):
            return cod_mun, ano, int(valor)
    except (ValueError, IndexError, TypeError):
        return cod_mun, ano, None
    return cod_mun, ano, None


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
    """Orquestra busca de dados IBGE em paralelo e salva em Parquet."""
    dest_dir = settings.resolve(settings.data_dir) if dest_dir is None else Path(dest_dir)
    logger.info("ibge_parquet_iniciando", dest_dir=str(dest_dir))

    combos = _infer_cod_ano_uf()
    if not combos:
        logger.warning("ibge_sem_combos_silver", msg="Nenhum municipio/ano encontrado no Silver")
        return

    codigos = sorted({c for (c, _, _) in combos})
    
    localidades = fetch_localidades()
    loc_map_7 = {m.cod_mun_ibge: m for m in localidades}
    loc_map_6 = {m.cod_mun_ibge[:6]: m for m in localidades}

    def _find_localidade(cod: str) -> MunicipioLocalidade | None:
        return loc_map_7.get(cod) or loc_map_6.get(cod[:6])

    # 1) Fetch Centroides em paralelo
    logger.info("ibge_centroides_iniciando", total_municipios=len(codigos))
    coords_map = {}
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        futures = {executor.submit(fetch_centroide_municipio, cod) for cod in codigos}
        for future in as_completed(futures):
            cod_result, result = future.result()
            if result:
                coords_map[cod_result] = result

    # 2) Monta DataFrame de municípios
    municipios_rows = []
    for cod in codigos:
        loc = _find_localidade(cod)
        if loc:
            coords = coords_map.get(loc.cod_mun_ibge, {})
            municipios_rows.append({
                "cod_mun_ibge": loc.cod_mun_ibge, "nome": loc.nome, "uf": loc.uf,
                "regiao": loc.regiao, "lat": coords.get("lat"), "lon": coords.get("lon"),
            })
    df_mun = pd.DataFrame(municipios_rows).drop_duplicates(subset=["cod_mun_ibge"])
    _write_parquet(df_mun, dest_dir / "ibge_municipios.parquet")
    logger.info("ibge_municipios_salvo", registros=len(df_mun))

    # 3) Fetch População em paralelo
    logger.info("ibge_populacao_iniciando", total_combos=len(combos))
    pop_rows = []
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        # Garante que usamos o código de 7 dígitos do IBGE para a API
        tasks = {
            executor.submit(
                fetch_populacao,
                (_find_localidade(cod).cod_mun_ibge if _find_localidade(cod) else cod),
                ano
            )
            for cod, ano, _ in combos
        }
        for future in as_completed(tasks):
            cod, ano, pop = future.result()
            if pop:
                pop_rows.append({"cod_mun_ibge": cod, "ano": ano, "populacao": pop})
            else:
                logger.warning("ibge_populacao_indisponivel", cod_mun_ibge=cod, ano=ano)

    df_pop = pd.DataFrame(pop_rows).drop_duplicates(subset=["cod_mun_ibge", "ano"])
    _write_parquet(df_pop, dest_dir / "ibge_populacao.parquet")
    logger.info("ibge_populacao_salvo", registros=len(df_pop))
    
    # 4) Malhas GeoJSON
    baixar_malhas_geojson(dest_dir / "ibge_malhas_municipios.geojson")

def baixar_malhas_geojson(dest: Path | None = None) -> Path:
    """Baixa GeoJSON de malhas de TODOS os municípios do Brasil (IBGE v4)."""
    import json

    if dest is None:
        dest = settings.resolve(settings.data_dir) / "ibge_malhas_municipios.geojson"
    dest = Path(dest)
    dest.parent.mkdir(parents=True, exist_ok=True)

    if dest.exists():
        logger.info("ibge_malhas_cache", path=str(dest), msg="Arquivo já existe, pulando download")
        return dest

    logger.info("ibge_malhas_download", url=MALHAS_BR_URL)
    resp = _http_get_with_retry(MALHAS_BR_URL, timeout=60.0)
    if not resp:
        return dest
        
    geojson = resp.json()

    n_features = len(geojson.get("features", []))
    logger.info("ibge_malhas_recebido", features=n_features)

    dest.write_text(json.dumps(geojson, ensure_ascii=False), encoding="utf-8")
    logger.info("ibge_malhas_salvo", path=str(dest), size_kb=round(dest.stat().st_size / 1024))
    return dest
