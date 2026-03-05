"""Gerador de dados amostrais realistas do SIM e SIA.

Gera dados com distribuicoes estatisticas que simulam padroes reais.
Se existir data/ibge_municipios.parquet (e opcionalmente ibge_populacao.parquet),
usa municipios reais do IBGE; senao usa lista fixa de 9 municipios.
"""

import random
from datetime import date

import duckdb
import pandas as pd

from .config import settings
from .logging import get_logger

logger = get_logger(__name__)

# ── Municipios: Parquet IBGE se existir, senao fallback ─────────────────────

MUNICIPIOS_FALLBACK = {
    "3550308": {
        "nome": "Sao Paulo",
        "uf": "SP",
        "lat": -23.5505,
        "lon": -46.6333,
        "pop": 12_300_000,
    },
    "3509502": {"nome": "Campinas", "uf": "SP", "lat": -22.9099, "lon": -47.0626, "pop": 1_200_000},
    "3518800": {
        "nome": "Guarulhos",
        "uf": "SP",
        "lat": -23.4628,
        "lon": -46.5333,
        "pop": 1_400_000,
    },
    "3106200": {
        "nome": "Belo Horizonte",
        "uf": "MG",
        "lat": -19.9167,
        "lon": -43.9345,
        "pop": 2_500_000,
    },
    "3170206": {"nome": "Uberlandia", "uf": "MG", "lat": -18.9186, "lon": -48.2772, "pop": 700_000},
    "3118601": {"nome": "Contagem", "uf": "MG", "lat": -19.9312, "lon": -44.0539, "pop": 660_000},
    "2927408": {"nome": "Salvador", "uf": "BA", "lat": -12.9714, "lon": -38.5124, "pop": 2_900_000},
    "2933307": {
        "nome": "Vitoria da Conquista",
        "uf": "BA",
        "lat": -14.8619,
        "lon": -40.8444,
        "pop": 340_000,
    },
    "2910800": {
        "nome": "Feira de Santana",
        "uf": "BA",
        "lat": -12.2669,
        "lon": -38.9666,
        "pop": 620_000,
    },
}


def _load_municipios_from_parquet() -> dict | None:
    """Carrega municipios de data/ibge_municipios.parquet (+ pop de ibge_populacao se existir)."""
    data_dir = settings.resolve(settings.data_dir)
    mun_path = data_dir / "ibge_municipios.parquet"
    pop_path = data_dir / "ibge_populacao.parquet"
    if not mun_path.exists():
        return None
    try:
        con = duckdb.connect(":memory:")
        df_mun = con.execute(f"SELECT * FROM read_parquet('{mun_path}')").fetchdf()
        con.close()
        if df_mun.empty:
            return None
        # Populacao: usar 2023 se existir ibge_populacao, senao estimativa por regiao
        pop_por_cod: dict[str, int] = {}
        if pop_path.exists():
            con = duckdb.connect(":memory:")
            df_pop = con.execute(
                f"SELECT cod_mun_ibge, populacao FROM read_parquet('{pop_path}') WHERE ano = 2023"
            ).fetchdf()
            con.close()
            pop_por_cod = df_pop.set_index("cod_mun_ibge")["populacao"].to_dict()
        out = {}
        for _, row in df_mun.iterrows():
            cod = str(row["cod_mun_ibge"])
            pop = pop_por_cod.get(cod)
            if pop is None:
                pop = 200_000  # fallback para amostra
            out[cod] = {
                "nome": row["nome"],
                "uf": row["uf"],
                "lat": float(row["lat"]) if row["lat"] is not None else None,
                "lon": float(row["lon"]) if row["lon"] is not None else None,
                "pop": int(pop),
            }
        return out if out else None
    except Exception as e:
        logger.warning("sample_data_ibge_parquet_falha", erro=str(e))
        return None


def get_municipios() -> dict:
    """Retorna dict de municipios (IBGE Parquet se existir, senao fallback)."""
    muns = _load_municipios_from_parquet()
    return muns if muns is not None else MUNICIPIOS_FALLBACK


# Compatibilidade: MUNICIPIOS aponta para o resultado de get_municipios() na importacao.
# Em runtime, gerar_sim/gerar_sia usam get_municipios() para permitir parquet apos pipeline.
MUNICIPIOS = MUNICIPIOS_FALLBACK

CID_TRANSITO = {
    "V01-V09": {"desc": "Pedestre", "peso": 0.12},
    "V10-V19": {"desc": "Ciclista", "peso": 0.06},
    "V20-V29": {"desc": "Motociclista", "peso": 0.35},
    "V30-V39": {"desc": "Triciclo", "peso": 0.02},
    "V40-V49": {"desc": "Automovel", "peso": 0.28},
    "V50-V59": {"desc": "Caminhonete", "peso": 0.05},
    "V60-V69": {"desc": "Veiculo pesado", "peso": 0.04},
    "V70-V79": {"desc": "Onibus", "peso": 0.03},
    "V80-V89": {"desc": "Outros", "peso": 0.05},
}

FAIXAS_ETARIAS = [
    ("0-14", 0.05),
    ("15-24", 0.25),
    ("25-34", 0.28),
    ("35-44", 0.18),
    ("45-54", 0.12),
    ("55-64", 0.07),
    ("65+", 0.05),
]

SAZONALIDADE = {
    1: 1.15,
    2: 1.10,
    3: 1.00,
    4: 0.95,
    5: 0.90,
    6: 0.85,
    7: 0.90,
    8: 0.92,
    9: 0.95,
    10: 1.05,
    11: 1.10,
    12: 1.20,
}

_TENDENCIA = {2019: 1.10, 2020: 0.80, 2021: 0.90, 2022: 1.00, 2023: 1.05}


def _random_cid() -> str:
    """Sorteia um CID-10 de acidente de transito com peso realista."""
    ranges = list(CID_TRANSITO.keys())
    pesos = [CID_TRANSITO[r]["peso"] for r in ranges]
    faixa = random.choices(ranges, weights=pesos, k=1)[0]
    inicio, fim = faixa.split("-")
    num = random.randint(int(inicio[1:]), int(fim[1:]))
    sufixo = random.randint(0, 9)
    return f"V{num:02d}{sufixo}"


def _random_idade() -> int:
    """Sorteia idade conforme distribuicao epidemiologica."""
    faixas = [f[0] for f in FAIXAS_ETARIAS]
    pesos = [f[1] for f in FAIXAS_ETARIAS]
    faixa = random.choices(faixas, weights=pesos, k=1)[0]
    if faixa == "0-14":
        return random.randint(0, 14)
    if faixa == "65+":
        return random.randint(65, 90)
    lo, hi = faixa.split("-")
    return random.randint(int(lo), int(hi))


def _taxa_obitos(pop: int) -> int:
    """Taxa base mensal de obitos proporcional a populacao."""
    return max(1, int(pop / 280_000))


def _taxa_atendimentos(pop: int) -> int:
    """Taxa base mensal de atendimentos proporcional a populacao."""
    return max(2, int(pop / 32_000))


def gerar_sim(anos: list[int] | None = None, seed: int = 42) -> pd.DataFrame:
    """Gera dados amostrais do SIM (mortalidade) por acidentes de transito."""
    random.seed(seed)
    anos = anos or list(range(2019, 2024))
    municipios = get_municipios()
    registros: list[dict] = []

    for ano in anos:
        for mes in range(1, 13):
            for cod_mun, info in municipios.items():
                base = _taxa_obitos(info["pop"])
                n = int(
                    base * SAZONALIDADE[mes] * _TENDENCIA.get(ano, 1.0) * random.uniform(0.8, 1.2)
                )
                for _ in range(max(1, n)):
                    registros.append(
                        {
                            "CAUSABAS": _random_cid(),
                            "DTOBITO": date(ano, mes, random.randint(1, 28)).isoformat(),
                            "CODMUNOCOR": cod_mun,
                            "CODMUNRES": cod_mun,
                            "SEXO": random.choices([1, 2], weights=[0.75, 0.25], k=1)[0],
                            "IDADE": _random_idade(),
                            "UF": info["uf"],
                        }
                    )

    df = pd.DataFrame(registros)
    df["DTOBITO"] = pd.to_datetime(df["DTOBITO"])
    logger.info("sim_gerado", registros=len(df), anos=anos)
    return df


def gerar_sia(anos: list[int] | None = None, seed: int = 42) -> pd.DataFrame:
    """Gera dados amostrais do SIA (ambulatorial) por acidentes de transito."""
    random.seed(seed + 1)
    anos = anos or list(range(2019, 2024))
    registros: list[dict] = []

    custo_medio = {
        "V01-V09": 850.0,
        "V10-V19": 720.0,
        "V20-V29": 2800.0,
        "V30-V39": 1500.0,
        "V40-V49": 3200.0,
        "V50-V59": 2600.0,
        "V60-V69": 4100.0,
        "V70-V79": 3800.0,
        "V80-V89": 1900.0,
    }

    municipios = get_municipios()
    for ano in anos:
        for mes in range(1, 13):
            for cod_mun, info in municipios.items():
                base = _taxa_atendimentos(info["pop"])
                n = int(
                    base * SAZONALIDADE[mes] * _TENDENCIA.get(ano, 1.0) * random.uniform(0.85, 1.15)
                )
                for _ in range(max(1, n)):
                    cid = _random_cid()
                    faixa = next(
                        k for k in custo_medio if int(k[1:3]) <= int(cid[1:3]) <= int(k[5:7])
                    )
                    valor = custo_medio[faixa] * random.uniform(0.3, 3.5)
                    registros.append(
                        {
                            "PA_CIDPRI": cid,
                            "PA_UFMUN": f"{info['uf']}{cod_mun[-4:]}",
                            "PA_CODMUN": cod_mun,
                            "PA_MUNAT": cod_mun,
                            "PA_DATREF": f"{ano}{mes:02d}",
                            "PA_VALAPR": round(valor, 2),
                            "PA_QTDAPR": random.randint(1, 5),
                            "PA_SEXO": random.choices(["M", "F"], weights=[0.73, 0.27], k=1)[0],
                            "PA_IDADE": _random_idade(),
                            "UF": info["uf"],
                        }
                    )

    df = pd.DataFrame(registros)
    logger.info("sia_gerado", registros=len(df), anos=anos)
    return df
