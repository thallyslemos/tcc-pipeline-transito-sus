"""
Configurações do pipeline analítico de acidentes de trânsito no SUS.

Centraliza paths, constantes e parâmetros para garantir consistência
e facilitar manutenção. Segue princípio de responsabilidade com dados.
"""

from pathlib import Path

# Path base do projeto
PROJECT_ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = PROJECT_ROOT / "data"
LOG_DIR = PROJECT_ROOT / "logs"

# Camadas Medallion
BRONZE_DIR = DATA_DIR / "bronze"
SILVER_DIR = DATA_DIR / "silver"
GOLD_DIR = DATA_DIR / "gold"

# CID-10 Acidentes de Trânsito (V01 a V89)
CID_TRANSITO_PREFIX = "V"
CID_TRANSITO_RANGE = (1, 89)  # V01 a V89

# Municípios prioritários (código IBGE 6 dígitos)
MUNICIPIOS_PRIORITARIOS = {
    "3550308": "São Paulo",
    "3106200": "Belo Horizonte",
    "2933307": "Vitória da Conquista",
}

# UFs para amostra inicial
UFS_AMOSTRA: list[str] = ["BA", "SP", "MG"]

# Anos para EDA inicial
ANOS_AMOSTRA: list[int] = [2022, 2023]


def get_settings() -> dict:
    """
    Retorna dicionário com configurações ativas.

    Returns:
        dict: Configurações do ambiente.
    """
    return {
        "project_root": str(PROJECT_ROOT),
        "data_dir": str(DATA_DIR),
        "log_dir": str(LOG_DIR),
        "bronze_dir": str(BRONZE_DIR),
        "silver_dir": str(SILVER_DIR),
        "gold_dir": str(GOLD_DIR),
        "cid_transito": f"{CID_TRANSITO_PREFIX}{CID_TRANSITO_RANGE[0]:02d}-V{CID_TRANSITO_RANGE[1]:02d}",
    }


def ensure_dirs() -> None:
    """Cria diretórios necessários se não existirem."""
    for path in [DATA_DIR, LOG_DIR, BRONZE_DIR, SILVER_DIR, GOLD_DIR]:
        path.mkdir(parents=True, exist_ok=True)


# Garante diretórios ao importar
ensure_dirs()
