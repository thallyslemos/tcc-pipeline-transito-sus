"""Configuração do backend via Pydantic Settings.

Compartilha o mesmo .env do pipeline. Cada módulo lê
apenas as variáveis que precisa.
"""

from pathlib import Path

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_PROJECT_ROOT = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    """Configurações do backend FastAPI."""

    model_config = SettingsConfigDict(
        env_file=str(_PROJECT_ROOT / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_env: str = "development"
    log_level: str = "INFO"
    backend_host: str = "0.0.0.0"
    backend_port: int = 8000
    backend_reload: bool = True
    gold_dir: str = "data/gold"
    cors_origins: str = "http://localhost:3000,http://localhost:8000"
    geojson_path: str = "data/ibge_malhas_municipios.geojson"

    # PostgreSQL (produção / VPS). Sem URL: mantém DuckDB + Parquet.
    use_postgres: bool = False
    database_url: str | None = None
    postgres_schema: str = "public"

    # Segurança (produção: MCP e predict desligados por padrão)
    mcp_bridge_enabled: bool | None = None
    predict_enabled: bool | None = None
    rate_limit_rpm: int = 60

    @field_validator("rate_limit_rpm")
    @classmethod
    def _rpm_minimo(cls, v: int) -> int:
        return max(v, 10)

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def mcp_bridge_active(self) -> bool:
        if self.mcp_bridge_enabled is not None:
            return self.mcp_bridge_enabled
        return self.app_env != "production"

    @property
    def predict_active(self) -> bool:
        if self.predict_enabled is not None:
            return self.predict_enabled
        return self.app_env != "production"

    @property
    def project_root(self) -> Path:
        return _PROJECT_ROOT

    def resolve(self, relative: str) -> Path:
        """Resolve um caminho relativo a partir da raiz do projeto."""
        return _PROJECT_ROOT / relative


settings = Settings()
