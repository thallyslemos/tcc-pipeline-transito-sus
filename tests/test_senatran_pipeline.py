"""Testes unitários do ETL independente de frota SENATRAN."""

from datetime import date
from importlib import import_module

import pandas as pd
import pytest


@pytest.fixture
def module():
    return import_module("data-pipeline.senatran_pipeline")


def _source(module):
    row = {
        "UF": "BA",
        "MUNICIPIO": "LAGEDO DO TABOCAL",
        "TOTAL": 18,
        **{vehicle: 0 for vehicle in module.VEHICLE_TYPES},
    }
    row["AUTOMOVEL"] = 10
    row["MOTOCICLETA"] = 5
    row["MOTONETA"] = 2
    row["CICLOMOTOR"] = 1
    return pd.DataFrame([row])


def test_parse_years(module):
    assert module.parse_years("2010:2012") == [2010, 2011, 2012]
    assert module.parse_years("2024,2022,2024") == [2022, 2024]


def test_discover_historical_bundle_does_not_access_network(module):
    resource = module.discover_resource(2010)
    assert resource.resource_url.endswith("/2010/frota_2010.zip")
    assert resource.year == 2010


def test_discover_resource_prefers_december_municipal_type(module):
    class Response:
        text = """
        <a href="jan.xls">Frota por Município e Tipo - Janeiro</a>
        <a href="dez.xlsx">Frota por Município e Tipo - Dezembro</a>
        """

        def raise_for_status(self):
            return None

    class Client:
        def get(self, *_args, **_kwargs):
            return Response()

    resource = module.discover_resource(2024, Client())
    assert resource.resource_url.endswith("dez.xlsx")


def test_choose_workbook_requires_december_municipal_snapshot(module):
    assert module._choose_workbook(
        ["Frota Munic. AGO.2012.xls", "Frota Munic.DEZ.2012.xls"]
    ).endswith("DEZ.2012.xls")
    with pytest.raises(module.SenatranError, match="sem planilha municipal de dezembro"):
        module._choose_workbook(["Frota Munic. AGO.2012.xls"])


def test_bridge_uses_reviewed_alias_and_keeps_canonical_seven_digits(module):
    source = _source(module)
    ibge = pd.DataFrame(
        [
            {
                "cod_mun_ibge": "2919058",
                "uf": "BA",
                "municipio_ibge": "Lajedo do Tabocal",
                "municipio_key": "LAJEDO DO TABOCAL",
            }
        ]
    )
    aliases = pd.DataFrame(
        [
            {
                "uf": "BA",
                "municipio_senatran": "LAGEDO DO TABOCAL",
                "municipio_key": "LAGEDO DO TABOCAL",
                "cod_mun_ibge": "2919058",
            }
        ]
    )
    bridged = module.bridge_municipalities(source, ibge, aliases)
    assert bridged.loc[0, "cod_mun_ibge"] == "2919058"
    assert bridged.loc[0, "match_status"] == "alias"
    assert bridged.loc[0, "municipio_ibge"] == "Lajedo do Tabocal"


def test_bridge_never_promotes_fuzzy_candidate(module):
    source = _source(module).assign(MUNICIPIO="LAJEDO TABOCAL")
    ibge = pd.DataFrame(
        [
            {
                "cod_mun_ibge": "2919058",
                "uf": "BA",
                "municipio_ibge": "Lajedo do Tabocal",
                "municipio_key": "LAJEDO DO TABOCAL",
            }
        ]
    )
    bridged = module.bridge_municipalities(source, ibge, module.load_aliases(None))
    assert pd.isna(bridged.loc[0, "cod_mun_ibge"])
    assert bridged.loc[0, "match_status"] == "unmatched"


def test_bridge_rejects_alias_outside_its_ibge_state(module):
    source = _source(module)
    ibge = pd.DataFrame(
        [
            {
                "cod_mun_ibge": "3550308",
                "uf": "SP",
                "municipio_ibge": "São Paulo",
                "municipio_key": "SAO PAULO",
            }
        ]
    )
    aliases = pd.DataFrame(
        [
            {
                "uf": "BA",
                "municipio_senatran": "LAGEDO DO TABOCAL",
                "municipio_key": "LAGEDO DO TABOCAL",
                "cod_mun_ibge": "3550308",
                "action": "map",
            }
        ]
    )
    with pytest.raises(module.SenatranError, match="integridade referencial"):
        module.bridge_municipalities(source, ibge, aliases)


def test_validate_source_reconciles_total(module):
    report = module.validate_source(_source(module), 2024)
    assert report["national_total"] == 18
    assert report["inconsistent_horizontal_totals"] == 0


def test_validate_source_rejects_horizontal_difference(module):
    source = _source(module)
    source.loc[0, "TOTAL"] = 19
    with pytest.raises(module.SenatranError, match="totais_inconsistentes=1"):
        module.validate_source(source, 2024)


def test_normalize_builds_explicit_motorized_two_wheel_group(module, monkeypatch, tmp_path):
    source = _source(module)
    monkeypatch.setattr(
        module,
        "read_official_workbook",
        lambda _path: (source, "DEZ_2024", "frota.xlsx"),
    )
    ibge = pd.DataFrame(
        [
            {
                "cod_mun_ibge": "2919058",
                "uf": "BA",
                "municipio_ibge": "Lajedo do Tabocal",
                "municipio_key": "LAJEDO DO TABOCAL",
            }
        ]
    )
    aliases = pd.DataFrame(
        [
            {
                "uf": "BA",
                "municipio_senatran": "LAGEDO DO TABOCAL",
                "municipio_key": "LAGEDO DO TABOCAL",
                "cod_mun_ibge": "2919058",
            }
        ]
    )
    snapshot = tmp_path / "ignored.xls"
    snapshot.write_bytes(b"fixture")
    artifact = module.BronzeArtifact(
        2024,
        12,
        "page",
        "https://fonte.oficial/2024/dezembro/frota-dez.xlsx",
        str(snapshot),
        module._sha256_file(snapshot),
        snapshot.stat().st_size,
        "2026-08-05T00:00:00+00:00",
        None,
        None,
        None,
    )
    silver, annual, report = module.normalize_artifact(
        artifact, ibge, aliases, require_national_coverage=False
    )
    assert len(silver) == len(module.VEHICLE_TYPES)
    assert int(annual.loc[0, "frota_duas_rodas_motorizadas"]) == 8
    assert int(annual.loc[0, "frota_total"]) == 18
    assert annual.loc[0, "competencia"] == date(2024, 12, 1)
    assert report["match_status"] == {"alias": 1}
    assert report["reference_month"] == 12


def test_normalize_rejects_source_without_december_evidence(module, monkeypatch, tmp_path):
    source = _source(module)
    monkeypatch.setattr(
        module,
        "read_official_workbook",
        lambda _path: (source, "AGO_2024", "frota-agosto.xlsx"),
    )
    snapshot = tmp_path / "ignored.xls"
    snapshot.write_bytes(b"fixture")
    artifact = module.BronzeArtifact(
        2024,
        12,
        "page",
        "https://fonte.oficial/2024/agosto/frota-ago.xlsx",
        str(snapshot),
        module._sha256_file(snapshot),
        snapshot.stat().st_size,
        "2026-08-05T00:00:00+00:00",
        None,
        None,
        None,
    )
    with pytest.raises(module.SenatranError, match="sem evidência verificável de dezembro"):
        module.normalize_artifact(
            artifact,
            pd.DataFrame(),
            module.load_aliases(None),
            require_national_coverage=False,
        )


def test_publish_blocks_unmatched_before_writing_gold(module, monkeypatch, tmp_path):
    source = _source(module).assign(MUNICIPIO="SEM CORRESPONDENCIA")
    monkeypatch.setattr(
        module,
        "read_official_workbook",
        lambda _path: (source, "DEZ_2024", "frota.xlsx"),
    )
    municipalities = tmp_path / "municipios.csv"
    municipalities.write_text(
        "UF,Código Município Completo,Nome_Município\n29,2919058,Lajedo do Tabocal\n",
        encoding="utf-8",
    )
    snapshot = tmp_path / "ignored.xls"
    snapshot.write_bytes(b"fixture")
    artifact = module.BronzeArtifact(
        2024,
        12,
        "page",
        "https://fonte.oficial/2024/dezembro/frota-dez.xlsx",
        str(snapshot),
        module._sha256_file(snapshot),
        snapshot.stat().st_size,
        "2026-08-05T00:00:00+00:00",
        None,
        None,
        None,
    )
    with pytest.raises(module.SenatranError, match="não pareados"):
        module.publish_products(
            [artifact], tmp_path, municipalities, None, require_national_coverage=False
        )
    assert (tmp_path / "quality" / "senatran_frota_qa.json").exists()
    assert not (tmp_path / "gold" / "frota_municipio_ano.parquet").exists()


def test_merge_years_preserves_unprocessed_history(module, tmp_path):
    path = tmp_path / "fleet.parquet"
    pd.DataFrame(
        [{"ano": 2023, "cod_mun_ibge": "2919058", "frota_total": 10}]
    ).to_parquet(path, index=False)
    current = pd.DataFrame(
        [{"ano": 2024, "cod_mun_ibge": "2919058", "frota_total": 12}]
    )

    merged = module._merge_years(current, path, ["ano", "cod_mun_ibge"])

    assert merged["ano"].tolist() == [2023, 2024]
