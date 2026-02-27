"""Gerador de dados amostrais realistas do SIM e SIA.

Gera dados com distribuições estatísticas que simulam padrões reais:
- Sazonalidade (mais acidentes em dez/jan)
- Diferenças regionais (SP >> BH >> VC)
- Subcategorias CID-10 V01-V89 com pesos realistas
- Faixas etárias e sexo conforme perfil epidemiológico
"""

import random
from datetime import date

import pandas as pd

from .logging import get_logger

logger = get_logger(__name__)

# ── Constantes ──────────────────────────────────────────────────────

MUNICIPIOS = {
    "3550308": {"nome": "São Paulo", "uf": "SP", "pop": 12_300_000},
    "3106200": {"nome": "Belo Horizonte", "uf": "MG", "pop": 2_500_000},
    "2933307": {"nome": "Vitória da Conquista", "uf": "BA", "pop": 340_000},
}

CID_TRANSITO = {
    "V01-V09": {"desc": "Pedestre", "peso": 0.12},
    "V10-V19": {"desc": "Ciclista", "peso": 0.06},
    "V20-V29": {"desc": "Motociclista", "peso": 0.35},
    "V30-V39": {"desc": "Triciclo", "peso": 0.02},
    "V40-V49": {"desc": "Automóvel", "peso": 0.28},
    "V50-V59": {"desc": "Caminhonete", "peso": 0.05},
    "V60-V69": {"desc": "Veículo pesado", "peso": 0.04},
    "V70-V79": {"desc": "Ônibus", "peso": 0.03},
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


def _random_cid() -> str:
    """Sorteia um CID-10 de acidente de trânsito com peso realista."""
    ranges = list(CID_TRANSITO.keys())
    pesos = [CID_TRANSITO[r]["peso"] for r in ranges]
    faixa = random.choices(ranges, weights=pesos, k=1)[0]
    inicio, fim = faixa.split("-")
    num = random.randint(int(inicio[1:]), int(fim[1:]))
    sufixo = random.randint(0, 9)
    return f"V{num:02d}{sufixo}"


def _random_idade() -> int:
    """Sorteia idade conforme distribuição epidemiológica."""
    faixas = [f[0] for f in FAIXAS_ETARIAS]
    pesos = [f[1] for f in FAIXAS_ETARIAS]
    faixa = random.choices(faixas, weights=pesos, k=1)[0]
    if faixa == "0-14":
        return random.randint(0, 14)
    if faixa == "65+":
        return random.randint(65, 90)
    lo, hi = faixa.split("-")
    return random.randint(int(lo), int(hi))


def gerar_sim(
    anos: list[int] | None = None,
    seed: int = 42,
) -> pd.DataFrame:
    """Gera dados amostrais do SIM (mortalidade) por acidentes de trânsito.

    Args:
        anos: Lista de anos a gerar. Padrão: 2019-2023.
        seed: Semente para reprodutibilidade.

    Returns:
        DataFrame com colunas análogas ao SIM do DATASUS.
    """
    random.seed(seed)
    anos = anos or list(range(2019, 2024))
    registros: list[dict] = []

    taxa_base = {
        "3550308": 45,
        "3106200": 18,
        "2933307": 4,
    }

    tendencia_anual = {2019: 1.10, 2020: 0.80, 2021: 0.90, 2022: 1.00, 2023: 1.05}

    for ano in anos:
        for mes in range(1, 13):
            for cod_mun, info in MUNICIPIOS.items():
                base = taxa_base[cod_mun]
                n = int(
                    base
                    * SAZONALIDADE[mes]
                    * tendencia_anual.get(ano, 1.0)
                    * random.uniform(0.8, 1.2)
                )
                for _ in range(max(1, n)):
                    dia = random.randint(1, 28)
                    idade = _random_idade()
                    sexo = random.choices([1, 2], weights=[0.75, 0.25], k=1)[0]
                    registros.append(
                        {
                            "CAUSABAS": _random_cid(),
                            "DTOBITO": date(ano, mes, dia).isoformat(),
                            "CODMUNOCOR": cod_mun,
                            "CODMUNRES": cod_mun,
                            "SEXO": sexo,
                            "IDADE": idade,
                            "UF": info["uf"],
                        }
                    )

    df = pd.DataFrame(registros)
    df["DTOBITO"] = pd.to_datetime(df["DTOBITO"])
    logger.info("sim_gerado", registros=len(df), anos=anos)
    return df


def gerar_sia(
    anos: list[int] | None = None,
    seed: int = 42,
) -> pd.DataFrame:
    """Gera dados amostrais do SIA (ambulatorial) por acidentes de trânsito.

    Args:
        anos: Lista de anos a gerar. Padrão: 2019-2023.
        seed: Semente para reprodutibilidade.

    Returns:
        DataFrame com colunas análogas ao SIA/PA do DATASUS.
    """
    random.seed(seed + 1)
    anos = anos or list(range(2019, 2024))
    registros: list[dict] = []

    atendimentos_base = {
        "3550308": 380,
        "3106200": 130,
        "2933307": 28,
    }

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

    tendencia_anual = {2019: 1.05, 2020: 0.75, 2021: 0.88, 2022: 1.00, 2023: 1.08}

    for ano in anos:
        for mes in range(1, 13):
            for cod_mun, info in MUNICIPIOS.items():
                base = atendimentos_base[cod_mun]
                n = int(
                    base
                    * SAZONALIDADE[mes]
                    * tendencia_anual.get(ano, 1.0)
                    * random.uniform(0.85, 1.15)
                )
                for _ in range(max(1, n)):
                    cid = _random_cid()
                    faixa = next(
                        k for k in custo_medio if int(k[1:3]) <= int(cid[1:3]) <= int(k[5:7])
                    )
                    valor = custo_medio[faixa] * random.uniform(0.3, 3.5)
                    qtd = random.randint(1, 5)
                    registros.append(
                        {
                            "PA_CIDPRI": cid,
                            "PA_UFMUN": f"{info['uf']}{cod_mun[-4:]}",
                            "PA_CODMUN": cod_mun,
                            "PA_MUNAT": cod_mun,
                            "PA_DATREF": f"{ano}{mes:02d}",
                            "PA_VALAPR": round(valor, 2),
                            "PA_QTDAPR": qtd,
                            "PA_SEXO": random.choices(["M", "F"], weights=[0.73, 0.27], k=1)[0],
                            "PA_IDADE": _random_idade(),
                            "UF": info["uf"],
                        }
                    )

    df = pd.DataFrame(registros)
    logger.info("sia_gerado", registros=len(df), anos=anos)
    return df
