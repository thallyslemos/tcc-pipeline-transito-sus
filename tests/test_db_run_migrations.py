"""Garantias do runner de migrações (search_path / schema)."""

from db.run_migrations import _connect_kwargs, _sanitize_schema


def test_sanitize_schema_default_and_invalid() -> None:
    assert _sanitize_schema("") == "public"
    assert _sanitize_schema("   ") == "public"
    assert _sanitize_schema("bad-name") == "public"
    assert _sanitize_schema("bad name") == "public"


def test_sanitize_schema_valid() -> None:
    assert _sanitize_schema("public") == "public"
    assert _sanitize_schema("app") == "app"
    assert _sanitize_schema("app_data") == "app_data"


def test_connect_kwargs_sets_search_path() -> None:
    kw = _connect_kwargs("public")
    assert kw["autocommit"] is True
    assert "search_path=public,public" in kw["options"]
    assert kw["options"].startswith("-c ")

    kw2 = _connect_kwargs("staging")
    assert "search_path=staging,public" in kw2["options"]
