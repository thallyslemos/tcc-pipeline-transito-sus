"""Testes unitÃ¡rios do utilitÃ¡rio de auditoria Silver SIM."""

import importlib.util
from pathlib import Path

SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "auditar_silver_sim.py"
SPEC = importlib.util.spec_from_file_location("auditar_silver_sim", SCRIPT)
assert SPEC is not None and SPEC.loader is not None
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


def test_parse_part_name_extracts_expected_fields() -> None:
    assert MODULE.parse_part_name("sim_BA_2024_74.parquet") == ("BA", 2024, 74)


def test_parse_part_name_rejects_unrelated_file() -> None:
    assert MODULE.parse_part_name("sia_BA_2024_74.parquet") is None
