"""
Configuração centralizada de logs para o pipeline analítico.

Garante logs estruturados, rotação e níveis apropriados para
auditoria e troubleshooting. Evita vazamento de dados sensíveis.
"""

import logging
import sys
from datetime import datetime
from pathlib import Path

from config.settings import LOG_DIR

# Formato padrão - sem dados pessoais
LOG_FORMAT = "%(asctime)s | %(levelname)-8s | %(name)s | %(message)s"
DATE_FORMAT = "%Y-%m-%d %H:%M:%S"


def setup_logging(
    level: str = "INFO",
    log_file: bool = True,
    log_dir: Path | None = None,
) -> None:
    """
    Configura o sistema de logging do pipeline.

    Args:
        level: Nível de log (DEBUG, INFO, WARNING, ERROR).
        log_file: Se True, grava também em arquivo.
        log_dir: Diretório para arquivos de log. Default: config.LOG_DIR.
    """
    log_dir = log_dir or LOG_DIR
    log_dir.mkdir(parents=True, exist_ok=True)

    root = logging.getLogger()
    root.setLevel(getattr(logging, level.upper(), logging.INFO))

    # Remove handlers existentes para evitar duplicação
    for handler in root.handlers[:]:
        root.removeHandler(handler)

    formatter = logging.Formatter(LOG_FORMAT, datefmt=DATE_FORMAT)

    # Console
    console = logging.StreamHandler(sys.stdout)
    console.setFormatter(formatter)
    root.addHandler(console)

    # Arquivo (rotação por dia)
    if log_file:
        today = datetime.now().strftime("%Y-%m-%d")
        file_handler = logging.FileHandler(
            log_dir / f"pipeline_{today}.log",
            encoding="utf-8",
        )
        file_handler.setFormatter(formatter)
        root.addHandler(file_handler)


def get_logger(name: str) -> logging.Logger:
    """
    Retorna logger configurado para o módulo.

    Args:
        name: Nome do módulo (geralmente __name__).

    Returns:
        Logger configurado.
    """
    return logging.getLogger(name)
