"""Dados populacionais do IBGE para calculo de taxas relativas.

Fonte: IBGE - Estimativas da Populacao Residente (Tabela 6579 SIDRA)
Quando existem Parquets em data/ (ibge_municipios.parquet, ibge_populacao.parquet),
le deles; senao usa dicionarios embutidos (offline-first).
"""

from pathlib import Path

import duckdb

from .config import settings
from .logging import get_logger

logger = get_logger(__name__)


def _parquet_path(name: str) -> Path:
    return settings.resolve(settings.data_dir) / name


def _get_populacao_parquet(cod_mun: str, ano: int) -> int | None:
    """Le populacao do Parquet IBGE se existir."""
    path = _parquet_path("ibge_populacao.parquet")
    if not path.exists():
        return None
    try:
        con = duckdb.connect(":memory:")
        row = con.execute(
            "SELECT populacao FROM read_parquet(?) WHERE cod_mun_ibge = ? AND ano = ? LIMIT 1",
            [str(path), cod_mun, ano],
        ).fetchone()
        con.close()
        return int(row[0]) if row else None
    except Exception:
        return None


def _get_info_parquet(cod_mun: str) -> dict | None:
    """Le info do municipio do Parquet IBGE se existir."""
    path = _parquet_path("ibge_municipios.parquet")
    if not path.exists():
        return None
    try:
        con = duckdb.connect(":memory:")
        row = con.execute(
            "SELECT nome, uf, regiao, lat, lon FROM read_parquet(?) WHERE cod_mun_ibge = ? LIMIT 1",
            [str(path), cod_mun],
        ).fetchone()
        con.close()
        if not row:
            return None
        return {
            "nome": row[0],
            "uf": row[1],
            "regiao": row[2],
            "area_km2": None,
            "idh": None,
            "pib_per_capita": None,
        }
    except Exception:
        return None

# Populacao estimada por municipio/ano (fonte: IBGE Tabela 6579)
# Valores arredondados em milhares para o MVP
POPULACAO_ESTIMADA: dict[str, dict[int, int]] = {
    "3550308": {  # Sao Paulo
        2019: 12_252_023,
        2020: 12_325_232,
        2021: 12_396_372,
        2022: 11_451_999,
        2023: 11_895_578,
    },
    "3509502": {  # Campinas
        2019: 1_204_073,
        2020: 1_213_792,
        2021: 1_223_237,
        2022: 1_139_047,
        2023: 1_172_482,
    },
    "3518800": {  # Guarulhos
        2019: 1_392_121,
        2020: 1_404_694,
        2021: 1_416_896,
        2022: 1_291_784,
        2023: 1_332_011,
    },
    "3106200": {  # Belo Horizonte
        2019: 2_512_070,
        2020: 2_521_564,
        2021: 2_530_701,
        2022: 2_315_560,
        2023: 2_369_009,
    },
    "3170206": {  # Uberlandia
        2019: 691_305,
        2020: 699_097,
        2021: 706_597,
        2022: 706_597,
        2023: 724_681,
    },
    "3118601": {  # Contagem
        2019: 663_855,
        2020: 668_949,
        2021: 673_872,
        2022: 617_749,
        2023: 636_673,
    },
    "2927408": {  # Salvador
        2019: 2_872_347,
        2020: 2_886_698,
        2021: 2_900_319,
        2022: 2_418_005,
        2023: 2_480_790,
    },
    "2933307": {  # Vitoria da Conquista
        2019: 338_885,
        2020: 341_128,
        2021: 343_230,
        2022: 338_885,
        2023: 343_643,
    },
    "2910800": {  # Feira de Santana
        2019: 614_872,
        2020: 619_609,
        2021: 624_107,
        2022: 575_781,
        2023: 592_860,
    },
}

# Informacoes complementares dos municipios
INFO_MUNICIPIOS: dict[str, dict] = {
    "3550308": {
        "nome": "Sao Paulo",
        "uf": "SP",
        "regiao": "Sudeste",
        "area_km2": 1_521.11,
        "idh": 0.805,
        "pib_per_capita": 65_459,
    },
    "3509502": {
        "nome": "Campinas",
        "uf": "SP",
        "regiao": "Sudeste",
        "area_km2": 794.43,
        "idh": 0.805,
        "pib_per_capita": 55_963,
    },
    "3518800": {
        "nome": "Guarulhos",
        "uf": "SP",
        "regiao": "Sudeste",
        "area_km2": 318.68,
        "idh": 0.763,
        "pib_per_capita": 40_590,
    },
    "3106200": {
        "nome": "Belo Horizonte",
        "uf": "MG",
        "regiao": "Sudeste",
        "area_km2": 331.40,
        "idh": 0.810,
        "pib_per_capita": 39_169,
    },
    "3170206": {
        "nome": "Uberlandia",
        "uf": "MG",
        "regiao": "Sudeste",
        "area_km2": 4_115.21,
        "idh": 0.789,
        "pib_per_capita": 50_912,
    },
    "3118601": {
        "nome": "Contagem",
        "uf": "MG",
        "regiao": "Sudeste",
        "area_km2": 195.27,
        "idh": 0.756,
        "pib_per_capita": 40_017,
    },
    "2927408": {
        "nome": "Salvador",
        "uf": "BA",
        "regiao": "Nordeste",
        "area_km2": 692.82,
        "idh": 0.759,
        "pib_per_capita": 23_839,
    },
    "2933307": {
        "nome": "Vitoria da Conquista",
        "uf": "BA",
        "regiao": "Nordeste",
        "area_km2": 3_254.19,
        "idh": 0.678,
        "pib_per_capita": 18_149,
    },
    "2910800": {
        "nome": "Feira de Santana",
        "uf": "BA",
        "regiao": "Nordeste",
        "area_km2": 1_337.99,
        "idh": 0.712,
        "pib_per_capita": 19_787,
    },
}


def get_populacao(cod_mun: str, ano: int) -> int | None:
    """Retorna populacao estimada do municipio no ano (Parquet IBGE ou fallback)."""
    v = _get_populacao_parquet(cod_mun, ano)
    if v is not None:
        return v
    return POPULACAO_ESTIMADA.get(cod_mun, {}).get(ano)


def get_info(cod_mun: str) -> dict | None:
    """Retorna informacoes do municipio (Parquet IBGE ou fallback)."""
    info = _get_info_parquet(cod_mun)
    if info is not None:
        return info
    return INFO_MUNICIPIOS.get(cod_mun)


def taxa_por_100mil(valor: float, populacao: int) -> float:
    """Calcula taxa por 100 mil habitantes.

    Metodologia: DATASUS / OMS
    Formula: (numero de eventos / populacao) * 100.000
    Ref: http://tabnet.datasus.gov.br/cgi/idb2000/fqc12.htm
    """
    if populacao <= 0:
        return 0.0
    return round((valor / populacao) * 100_000, 2)


def custo_per_capita(custo: float, populacao: int) -> float:
    """Calcula custo per capita.

    Formula: custo_total / populacao
    """
    if populacao <= 0:
        return 0.0
    return round(custo / populacao, 2)
