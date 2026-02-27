"""Configuração centralizada via Pydantic Settings.

Carrega variáveis do arquivo `.env` na raiz do projeto.
Todas as constantes de caminho e comportamento ficam aqui.
"""

from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


_PROJECT_ROOT = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    """Configurações globais do pipeline e backend."""

    model_config = SettingsConfigDict(
        env_file=str(_PROJECT_ROOT / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Geral
    app_env: str = "development"
    log_level: str = "INFO"

    # Backend
    backend_host: str = "0.0.0.0"
    backend_port: int = 8000
    backend_reload: bool = True

    # DuckDB
    duckdb_path: str = "data/transito_sus.duckdb"

    # Diretórios Medallion
    data_dir: str = "data"
    bronze_dir: str = "data/bronze"
    silver_dir: str = "data/silver"
    gold_dir: str = "data/gold"

    # CORS
    cors_origins: str = "http://localhost:3000,http://localhost:8000"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",")]

    @property
    def project_root(self) -> Path:
        return _PROJECT_ROOT

    def resolve(self, relative: str) -> Path:
        """Resolve um caminho relativo a partir da raiz do projeto."""
        return _PROJECT_ROOT / relative


settings = Settings()
