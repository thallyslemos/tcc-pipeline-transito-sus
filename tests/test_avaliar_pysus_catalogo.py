"""Testes do resumo de cobertura do catálogo PySUS."""

from scripts.avaliar_pysus_catalogo import summarize_catalog_rows


def test_detects_missing_year_in_catalog() -> None:
    result = summarize_catalog_rows(
        [
            {"year": 2010, "name": "DOBA2010.parquet"},
            {"year": 2011, "name": "DOBA2011.parquet"},
        ],
        expected_years=[2010, 2011, 2012],
    )
    assert result["missing_years"] == [2012]


def test_preserves_catalog_records_for_lineage() -> None:
    rows = [{"year": 2024, "path": "public/data/ftp/sim/DOBA2024.parquet"}]
    result = summarize_catalog_rows(rows, expected_years=[2024])
    assert result["files"] == rows
