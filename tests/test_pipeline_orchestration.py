"""Testes de orquestração do pipeline (segregação de responsabilidades)."""

from importlib import import_module
from pathlib import Path


def test_run_sim_only_nao_executa_enriquecimento_externo(monkeypatch):
    """`--sim-only` não deve acionar job de enriquecimento (IBGE/SIDRA)."""
    run_mod = import_module("data-pipeline.run")
    datasus_mod = import_module("data-pipeline.datasus")

    called = {"ibge": 0}

    def _fake_run_ibge() -> None:
        called["ibge"] += 1

    monkeypatch.setattr(run_mod, "run_ibge", _fake_run_ibge)
    monkeypatch.setattr(datasus_mod, "UFS_BRASIL", ["BA"])
    monkeypatch.setattr(datasus_mod, "baixar_sim_streaming", lambda **_: Path("/tmp/sim_parts"))
    monkeypatch.setattr(run_mod, "processar_silver_sim", lambda _: Path("/tmp/silver_sim.parquet"))
    monkeypatch.setattr(run_mod, "gerar_gold_obitos_ocorrencia", lambda _: Path("/tmp/gold_occ.parquet"))
    monkeypatch.setattr(run_mod, "gerar_gold_obitos_residencia", lambda _: Path("/tmp/gold_res.parquet"))
    monkeypatch.setattr(
        run_mod,
        "gerar_gold_diario",
        lambda _a, silver_sia=None: Path("/tmp/gold_daily.parquet"),
    )

    run_mod.run_sim_only(ufs=["BA"], anos=[2024])

    assert called["ibge"] == 0


def test_salvar_ibge_parquet_deduplica_fetch_populacao(monkeypatch, tmp_path: Path):
    """IBGE fetch deve consultar população uma vez por município/ano."""
    ibge_mod = import_module("data-pipeline.ibge_fetcher")

    # Mesmo município/ano repetido por combinações oriundas de diferentes fontes.
    combos = [
        ("2900108", 2023, "BA"),
        ("2900108", 2023, "BA"),
        ("2900108", 2023, "BA"),
        ("2507507", 2023, "PB"),
    ]
    monkeypatch.setattr(ibge_mod, "_infer_cod_ano_uf", lambda: combos)
    monkeypatch.setattr(
        ibge_mod,
        "fetch_localidades",
        lambda: [
            ibge_mod.MunicipioLocalidade("2900108", "Abaíra", "BA", "Nordeste"),
            ibge_mod.MunicipioLocalidade("2507507", "João Pessoa", "PB", "Nordeste"),
        ],
    )
    monkeypatch.setattr(
        ibge_mod,
        "fetch_centroide_municipio",
        lambda cod: (cod, {"lat": -10.0, "lon": -40.0}),
    )
    monkeypatch.setattr(ibge_mod, "baixar_malhas_geojson", lambda _dest: Path("/tmp/malhas.geojson"))
    monkeypatch.setattr(ibge_mod, "MAX_WORKERS", 1)

    pop_calls: list[tuple[str, int]] = []

    def _fake_fetch_populacao(cod: str, ano: int):
        pop_calls.append((cod, ano))
        return cod, ano, 1000

    monkeypatch.setattr(ibge_mod, "fetch_populacao", _fake_fetch_populacao)

    # Evita escrita real em parquet no teste.
    monkeypatch.setattr(ibge_mod, "_write_parquet", lambda _df, _path: None)

    ibge_mod.salvar_ibge_parquet(tmp_path)

    assert sorted(set(pop_calls)) == [("2507507", 2023), ("2900108", 2023)]
    assert len(pop_calls) == 2
