"""Reexport da camada de dados (DuckDB ou PostgreSQL)."""

from .datastore import close_connection, get_connection

__all__ = ["close_connection", "get_connection"]
