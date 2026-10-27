"""Regressões materiais identificadas durante a integração das PRs do Jules."""

from importlib import import_module

import pandas as pd
import pytest
from backend.routers.utils import cod6_seguro


@pytest.mark.parametrize("value", [float("nan"), float("inf"), -float("inf")])
def test_postgres_preserva_valor_finito_e_converte_nao_finito_em_none(value):
    converter = import_module("data-pipeline.postgres_load")._df_for_insert
    frame = pd.DataFrame({"valor": [-14.85, value]})
    assert converter(frame, ["valor"]) == [(-14.85,), (None,)]


@pytest.mark.parametrize("code", ["293330", "2933307"])
def test_cod6_aceita_codigo_oficial_de_seis_ou_sete_digitos(code):
    assert cod6_seguro(code) == "293330"


def test_datastore_nao_inventa_obitos_quando_gold_esta_ausente(monkeypatch, tmp_path):
    from backend import datastore

    monkeypatch.setattr(datastore.settings, "gold_dir", str(tmp_path))
    with pytest.raises(FileNotFoundError):
        datastore._init_duckdb()
