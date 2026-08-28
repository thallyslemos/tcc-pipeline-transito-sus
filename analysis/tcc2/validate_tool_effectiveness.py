"""Compara respostas SIM da API com consultas DuckDB no mesmo recorte.

O script é uma validação de serving, não uma validação epidemiológica. Ele
usa o TestClient e as mesmas Golds configuradas para a aplicação, enquanto o
numerador independente é lido da Silver nacional com o filtro científico.
"""

from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path

import duckdb

DATA_ROOT = Path(
    os.environ.get(
        "TCC2_DATA_ROOT",
        "/home/thallys/projetos/tcc-pipeline-transito-sus/data",
    )
)
os.environ.setdefault("GOLD_DIR", str(DATA_ROOT / "gold"))
os.environ.setdefault("USE_POSTGRES", "false")


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for block in iter(lambda: source.read(8 * 1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def main() -> None:
    from backend.app import app
    from fastapi.testclient import TestClient

    silver = DATA_ROOT / "silver/sim_v2_nacional_2010_2024_contract_v2.parquet"
    params = {
        "dimensao": "ocorrencia",
        "ano": 2024,
        "uf": "BA",
        "tipo_veiculo": "Motociclista",
    }
    con = duckdb.connect()
    direct_total = con.execute(
        """
        SELECT count(*)
        FROM read_parquet(?)
        WHERE is_v01_v89 AND qa_status = 'ok' AND tipobito_raw = '2'
          AND ano_obito = 2024
          AND uf_ocorrencia = 'BA'
          AND tipo_veiculo = 'Motociclista'
          AND geografia_status_ocorrencia = 'encontrado'
        """,
        [str(silver)],
    ).fetchone()[0]
    direct_geo_total = con.execute(
        """
        SELECT coalesce(sum(total), 0)
        FROM (
            SELECT cod_mun_ocorrencia_ibge, count(*) AS total
            FROM read_parquet(?)
            WHERE is_v01_v89 AND qa_status = 'ok' AND tipobito_raw = '2'
              AND ano_obito = 2024
              AND uf_ocorrencia = 'BA'
              AND tipo_veiculo = 'Motociclista'
              AND geografia_status_ocorrencia = 'encontrado'
            GROUP BY cod_mun_ocorrencia_ibge
        )
        """,
        [str(silver)],
    ).fetchone()[0]

    with TestClient(app) as client:
        summary_response = client.get("/api/sim/summary", params=params)
        geo_response = client.get("/api/sim/geo", params=params)
    summary_response.raise_for_status()
    geo_response.raise_for_status()
    api_summary_total = summary_response.json()["total_obitos"]
    api_geo_total = sum(
        feature["properties"]["valor"] for feature in geo_response.json()["features"]
    )

    result = {
        "recorte": params,
        "silver": {"path": str(silver), "sha256": sha256(silver)},
        "api": {
            "summary_total_obitos": api_summary_total,
            "geo_total_valor": api_geo_total,
            "geo_poligonos": len(geo_response.json()["features"]),
        },
        "duckdb": {
            "silver_total_obitos": direct_total,
            "silver_geo_total_obitos": direct_geo_total,
        },
        "paridade": {
            "summary_vs_silver": api_summary_total == direct_total,
            "geo_vs_silver": api_geo_total == direct_geo_total,
        },
    }
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
