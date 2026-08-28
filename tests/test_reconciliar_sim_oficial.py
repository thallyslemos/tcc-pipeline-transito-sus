"""Testes da reconciliação diagnostica de snapshots oficiais."""

import importlib

module = importlib.import_module("scripts.reconciliar_sim_oficial")


def test_reconciliacao_nao_compara_ocorrencia_com_residencia():
    result = module.reconcile({2023: 2747, 2024: 3041})
    occurrence = [item for item in result["comparisons"] if item["scope"].startswith("ocorrencia")]
    residence = [item for item in result["comparisons"] if item["scope"].startswith("residencia")]
    assert occurrence
    assert all(item["comparability"].startswith("nao_comparavel") for item in occurrence)
    assert all("difference" in item for item in residence)


def test_reconciliacao_preserva_decisao_sem_tolerancia_automatica():
    result = module.reconcile({2023: 2754})
    assert "tolerancia" in result["decision"]
    assert result["observed_scope"].startswith("residencia")
