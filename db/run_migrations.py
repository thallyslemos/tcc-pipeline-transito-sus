"""Aplica migrações SQL versionadas em db/migrations/ (ordem lexicográfica).

Uso:
    DATABASE_URL=postgresql://user:pass@host:5432/db uv run python db/run_migrations.py
    uv run python db/run_migrations.py --database-url postgresql://...
"""

from __future__ import annotations

import argparse
import os
import re
from pathlib import Path

import psycopg
from psycopg.sql import SQL, Identifier

_MIGRATIONS_DIR = Path(__file__).resolve().parent / "migrations"
_PROJECT_ROOT = Path(__file__).resolve().parent.parent

_SCHEMA_SAFE = re.compile(r"^[a-zA-Z_][a-zA-Z0-9_]*$")


def _sanitize_schema(name: str) -> str:
    """Evita identificadores inválidos ou vazios que deixam search_path sem schema."""
    s = (name or "public").strip() or "public"
    if not _SCHEMA_SAFE.match(s):
        return "public"
    return s


def _connect_kwargs(schema: str) -> dict:
    """search_path no libpq evita 'no schema has been selected to create in' (sessão limpa)."""
    opts = f"-c search_path={schema},public"
    return {"autocommit": True, "options": opts}


def _load_dotenv() -> None:
    try:
        from dotenv import load_dotenv
    except ImportError:
        return
    load_dotenv(_PROJECT_ROOT / ".env")


def apply_migrations(dsn: str, schema: str = "public") -> None:
    """Executa cada ficheiro *.sql em ordem; uma transação por ficheiro."""
    files = sorted(_MIGRATIONS_DIR.glob("*.sql"))
    if not files:
        msg = f"Nenhuma migração em {_MIGRATIONS_DIR}"
        raise FileNotFoundError(msg)

    schema = _sanitize_schema(schema)
    _load_dotenv()
    schema_id = Identifier(schema)

    with psycopg.connect(dsn, **_connect_kwargs(schema)) as conn:
        with conn.cursor() as setup_cur:
            if schema != "public":
                setup_cur.execute(SQL("CREATE SCHEMA IF NOT EXISTS {}").format(schema_id))
            setup_cur.execute(SQL("SET search_path TO {}, public").format(schema_id))

        for path in files:
            sql = path.read_text(encoding="utf-8")
            with conn.transaction(), conn.cursor() as cur:
                cur.execute(SQL("SET search_path TO {}, public").format(schema_id))
                cur.execute(sql)
            print(f"OK {path.name}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Aplica migrações PostgreSQL")
    parser.add_argument(
        "--database-url",
        default=None,
        help="DSN (default: variável de ambiente DATABASE_URL)",
    )
    parser.add_argument(
        "--schema",
        default=os.environ.get("POSTGRES_SCHEMA", "public"),
        help="Schema alvo (default: POSTGRES_SCHEMA ou public)",
    )
    args = parser.parse_args()
    _load_dotenv()
    dsn = args.database_url or os.environ.get("DATABASE_URL")
    if not dsn:
        raise SystemExit("Defina DATABASE_URL ou passe --database-url")

    apply_migrations(dsn, schema=args.schema)


if __name__ == "__main__":
    main()
