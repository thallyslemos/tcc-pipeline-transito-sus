"""API de dados PRELIMINARES do SIM — camada complementar, isolada da consolidada.

DADOS PRELIMINARES NUNCA ENTRAM NA MESMA AGREGACAO QUE OS CONSOLIDADOS. Estes
endpoints sao inteiramente separados de /api/sim/*: nenhum parametro em
/api/sim/* pode habilitar dado preliminar, e nenhuma consulta aqui le os marts
consolidados (sim_v1_*) exceto para calcular o indicador de completude
(leitura, nunca escrita nem uniao de linhas).

Toda resposta carrega o bloco `aviso_preliminar`, para que nenhum cliente
consuma dado preliminar sem saber que e preliminar.
"""

from __future__ import annotations

from datetime import date
from pathlib import Path
from typing import Literal

from fastapi import APIRouter, HTTPException, Query

from ..config import settings
from ..database import get_connection
from .sim_only import _text
from .utils import REGIOES

router = APIRouter(prefix="/api/sim/prelim", tags=["SIM-preliminar"])
Role = Literal["ocorrencia", "residencia"]

_PRELIM_MARTS: dict[str, str] = {
    "ocorrencia": "sim_prelim_municipio_mes_ocorrencia.parquet",
    "residencia": "sim_prelim_municipio_mes_residencia.parquet",
}
_CONSOLIDADO_MARTS: dict[str, str] = {
    "ocorrencia": "sim_v1_obitos_municipio_mes_ocorrencia_v2.parquet",
    "residencia": "sim_v1_obitos_municipio_mes_residencia_v2.parquet",
}

_AVISO_TEXTO = (
    "Dados preliminares do SIM, sujeitos a revisao e ainda em captacao. "
    "Nao comparaveis com anos consolidados."
)


def _prelim_mart_path(role: Role) -> Path:
    if role not in _PRELIM_MARTS:
        raise HTTPException(status_code=422, detail="dimensao deve ser ocorrencia ou residencia")
    path = settings.resolve(settings.gold_dir) / _PRELIM_MARTS[role]
    if not path.exists():
        raise HTTPException(
            status_code=503,
            detail=(
                "Mart SIM preliminar indisponivel; execute a ingestao preliminar "
                "(run.py --prelim) antes de consultar esta API"
            ),
        )
    return path


def _source(path: Path) -> str:
    if settings.use_postgres and settings.database_url:
        raise HTTPException(
            status_code=503,
            detail="O contrato SIM preliminar local requer o backend DuckDB nesta fase",
        )
    return f"read_parquet('{str(path).replace(chr(39), chr(39) * 2)}')"


def _where_clauses(
    *,
    ano: int | None,
    uf: str | None,
    regiao: str | None,
    municipio: str | None = None,
) -> list[str]:
    clauses = ["1=1"]
    if ano is not None:
        clauses.append(f"ano = {ano}")
    if uf:
        clauses.append(f"uf = '{_text(uf.upper())}'")
    if regiao:
        if regiao not in REGIOES:
            raise HTTPException(status_code=422, detail="regiao invalida")
        ufs = ", ".join(f"'{state}'" for state in REGIOES[regiao])
        clauses.append(f"uf IN ({ufs})")
    if municipio:
        code = "".join(c for c in municipio if c.isdigit())[:6]
        if len(code) != 6:
            raise HTTPException(status_code=422, detail="municipio deve ter 6 digitos")
        clauses.append(f"cod_mun_ibge_6 = '{_text(code)}'")
    return clauses


def _aviso_preliminar(con, source: str, where: str) -> dict:
    """Bloco aviso_preliminar: data de extracao mais recente e completude media
    do recorte, quando calculavel (precisa de ano/uf definidos o suficiente)."""
    row = con.sql(f"SELECT MAX(data_extracao) FROM {source} WHERE {where}").fetchone()
    data_extracao = row[0].isoformat() if row and row[0] is not None else None
    return {
        "preliminar": True,
        "data_extracao": data_extracao,
        "completude_estimada": None,
        "texto": _AVISO_TEXTO,
    }


def _completude_query(
    con,
    *,
    role: Role,
    uf: str | None,
    ano: int,
) -> list[dict]:
    """completude_estimada(uf, mes, ano) = obitos_prelim / media(obitos_consolidado
    do mesmo mes nos ate 3 anos consolidados mais recentes anteriores a `ano`).

    Compara SOMENTE agregados ja materializados (leitura); nunca junta as
    linhas das duas camadas numa mesma consulta de UNIAO.
    """
    prelim_path = _prelim_mart_path(role)
    consolidado_path = settings.resolve(settings.gold_dir) / _CONSOLIDADO_MARTS[role]
    if not consolidado_path.exists():
        raise HTTPException(
            status_code=503, detail="Mart consolidado indisponivel para calcular completude"
        )

    uf_filter_prelim = f"AND uf = '{_text(uf.upper())}'" if uf else ""
    uf_filter_cons = f"AND uf = '{_text(uf.upper())}'" if uf else ""
    group_by = "uf, mes" if not uf else "mes"
    select_uf = "uf," if not uf else f"'{_text(uf.upper())}' AS uf,"

    prelim_source = _source(prelim_path)
    consolidado_source = f"read_parquet('{str(consolidado_path).replace(chr(39), chr(39) * 2)}')"

    query = f"""
        WITH prelim AS (
            SELECT {select_uf} mes, SUM(total_obitos) AS obitos_prelim
            FROM {prelim_source}
            WHERE ano = {ano} {uf_filter_prelim}
            GROUP BY {group_by}
        ),
        consolidado_anos AS (
            -- ate 3 anos consolidados mais recentes anteriores a `ano` (pode
            -- ser menos se o consolidado nao cobrir toda a janela).
            SELECT DISTINCT ano FROM {consolidado_source}
            WHERE ano < {ano}
            ORDER BY ano DESC
            LIMIT 3
        ),
        consolidado_media AS (
            SELECT {select_uf} mes, AVG(obitos_ano) AS media_consolidado
            FROM (
                SELECT {select_uf} mes, ano, SUM(total_obitos) AS obitos_ano
                FROM {consolidado_source}
                WHERE ano IN (SELECT ano FROM consolidado_anos) {uf_filter_cons}
                GROUP BY {group_by}, ano
            )
            GROUP BY {group_by}
        )
        SELECT
            COALESCE(p.uf, c.uf) AS uf,
            COALESCE(p.mes, c.mes) AS mes,
            p.obitos_prelim,
            c.media_consolidado,
            CASE WHEN c.media_consolidado > 0
                 THEN p.obitos_prelim / c.media_consolidado
                 ELSE NULL END AS completude_estimada
        FROM prelim p
        FULL OUTER JOIN consolidado_media c
          ON COALESCE(p.uf,'') = COALESCE(c.uf,'') AND p.mes = c.mes
        ORDER BY uf, mes
    """
    rows = con.sql(query).fetchdf().to_dict(orient="records")
    for r in rows:
        # FULL OUTER JOIN: um lado ausente vira NaN (nao None) apos fetchdf()
        # em colunas numericas do pandas — checar apenas "is not None" deixa
        # passar NaN e int()/round() explodem com ValueError.
        obitos_prelim = r.get("obitos_prelim")
        media_consolidado = r.get("media_consolidado")
        completude_estimada = r.get("completude_estimada")
        r["obitos_prelim"] = int(obitos_prelim) if obitos_prelim == obitos_prelim and obitos_prelim is not None else None
        r["media_consolidado"] = (
            round(float(media_consolidado), 2)
            if media_consolidado == media_consolidado and media_consolidado is not None
            else None
        )
        r["completude_estimada"] = (
            round(float(completude_estimada), 4)
            if completude_estimada == completude_estimada and completude_estimada is not None
            else None
        )
        r["mes"] = int(r["mes"])
    return rows


@router.get("/summary")
async def summary(
    dimensao: Role = Query("ocorrencia"),
    uf: str | None = Query(None, min_length=2, max_length=2),
    ano: int | None = Query(None, ge=2025, le=2100),
    municipio: str | None = Query(None, min_length=6, max_length=7),
) -> dict:
    path = _prelim_mart_path(dimensao)
    con = get_connection()
    source = _source(path)
    where = " AND ".join(_where_clauses(ano=ano, uf=uf, regiao=None, municipio=municipio))

    total, municipios, extracao = con.sql(
        f"""
        SELECT COALESCE(SUM(total_obitos), 0),
               COUNT(DISTINCT CASE WHEN geografia_status = 'encontrado' THEN cod_mun_ibge_6 END),
               MAX(data_extracao)
        FROM {source} WHERE {where}
        """
    ).fetchone()
    by_month = con.sql(
        f"""
        SELECT strftime(CAST(competencia AS DATE), '%Y-%m') AS competencia,
               SUM(total_obitos) AS total
        FROM {source} WHERE {where}
        GROUP BY competencia ORDER BY competencia
        """
    ).fetchall()

    completude_media = None
    if ano is not None:
        linhas = _completude_query(con, role=dimensao, uf=uf, ano=ano)
        valores = [linha["completude_estimada"] for linha in linhas if linha["completude_estimada"] is not None]
        completude_media = round(sum(valores) / len(valores), 4) if valores else None

    return {
        "fonte": "SIM-PRELIMINAR",
        "dimensao": dimensao,
        "total_obitos": int(total or 0),
        "municipios": int(municipios or 0),
        "obitos_por_mes": [
            {"competencia": str(competencia), "total": int(total_mes)} for competencia, total_mes in by_month
        ],
        "aviso_preliminar": {
            "preliminar": True,
            "data_extracao": extracao.isoformat() if extracao is not None else None,
            "completude_estimada": completude_media,
            "texto": _AVISO_TEXTO,
        },
    }


@router.get("/municipios")
async def municipios(
    dimensao: Role = Query("ocorrencia"),
    uf: str | None = Query(None, min_length=2, max_length=2),
    ano: int | None = Query(None, ge=2025, le=2100),
    municipio: str | None = Query(None, min_length=6, max_length=7),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
) -> dict:
    path = _prelim_mart_path(dimensao)
    con = get_connection()
    source = _source(path)
    where = " AND ".join(
        [*_where_clauses(ano=ano, uf=uf, regiao=None, municipio=municipio), "geografia_status = 'encontrado'"]
    )
    offset = (page - 1) * page_size

    total = con.sql(
        f"SELECT COUNT(*) FROM (SELECT cod_mun_ibge_6 FROM {source} WHERE {where} GROUP BY cod_mun_ibge_6)"
    ).fetchone()[0]
    rows = (
        con.sql(
            f"""
            SELECT cod_mun_ibge, cod_mun_ibge_6, municipio, uf,
                   SUM(total_obitos) AS obitos,
                   MAX(data_extracao) AS data_extracao
            FROM {source}
            WHERE {where}
            GROUP BY cod_mun_ibge, cod_mun_ibge_6, municipio, uf
            ORDER BY obitos DESC, municipio
            LIMIT {page_size} OFFSET {offset}
            """
        )
        .fetchdf()
        .to_dict(orient="records")
    )
    for row in rows:
        row["obitos"] = int(row["obitos"] or 0)
        row["data_extracao"] = row["data_extracao"].isoformat() if row.get("data_extracao") is not None else None

    extracao_geral = con.sql(f"SELECT MAX(data_extracao) FROM {source} WHERE {where}").fetchone()[0]
    return {
        "fonte": "SIM-PRELIMINAR",
        "dimensao": dimensao,
        "page": page,
        "page_size": page_size,
        "total": int(total),
        "municipios": rows,
        "aviso_preliminar": {
            "preliminar": True,
            "data_extracao": extracao_geral.isoformat() if extracao_geral is not None else None,
            "completude_estimada": None,
            "texto": _AVISO_TEXTO,
        },
    }


@router.get("/completude")
async def completude(
    dimensao: Role = Query("ocorrencia"),
    uf: str | None = Query(None, min_length=2, max_length=2),
    ano: int = Query(..., ge=2025, le=2100),
    municipio: str | None = Query(None, min_length=6, max_length=7),
) -> dict:
    """Indicador de completude por mes: SINAL de maturidade da base, nunca uma
    correcao/extrapolacao da contagem. Ver docs/DADOS_PRELIMINARES.md."""
    con = get_connection()
    linhas = _completude_query(con, role=dimensao, uf=uf, ano=ano)
    path = _prelim_mart_path(dimensao)
    source = _source(path)
    where = " AND ".join(_where_clauses(ano=ano, uf=uf, regiao=None, municipio=municipio))
    extracao = con.sql(f"SELECT MAX(data_extracao) FROM {source} WHERE {where}").fetchone()[0]

    return {
        "fonte": "SIM-PRELIMINAR",
        "dimensao": dimensao,
        "ano": ano,
        "uf": uf,
        "por_mes": linhas,
        "notas_metodologicas": (
            "completude_estimada = obitos_preliminares(mes) / media(obitos_consolidados "
            "do mesmo mes nos ate 3 anos consolidados mais recentes anteriores a `ano`). "
            "E um SINAL de maturidade da base (quanto da captacao tipica ja chegou), "
            "nao um fator de correcao — nunca multiplique a contagem preliminar por "
            "1/completude_estimada para 'estimar o total real'."
        ),
        "aviso_preliminar": {
            "preliminar": True,
            "data_extracao": extracao.isoformat() if extracao is not None else None,
            "completude_estimada": None,
            "texto": _AVISO_TEXTO,
        },
    }


@router.get("/metadata")
async def metadata() -> dict:
    """Metadados dinamicos da camada preliminar (calculados on-the-fly, ao
    contrario do catalogo consolidado — a base preliminar muda a cada
    ingestao, entao nao ha um snapshot estatico versionado)."""
    con = get_connection()
    datasets = []
    for role, filename in _PRELIM_MARTS.items():
        path = settings.resolve(settings.gold_dir) / filename
        if not path.exists():
            datasets.append(
                {
                    "id": f"sim_prelim_municipio_mes_{role}",
                    "layer": "gold",
                    "status": "preliminary",
                    "available": False,
                }
            )
            continue
        source = _source(path)
        total_obitos, linhas, extracao_min, extracao_max, anos = con.sql(
            f"""
            SELECT SUM(total_obitos), COUNT(*), MIN(data_extracao), MAX(data_extracao),
                   ARRAY_AGG(DISTINCT ano ORDER BY ano)
            FROM {source}
            """
        ).fetchone()
        datasets.append(
            {
                "id": f"sim_prelim_municipio_mes_{role}",
                "layer": "gold",
                "status": "preliminary",
                "available": True,
                "provider": "DATASUS/SIM (PRELIM/DORES)",
                "grain": "municipio + mes + tipo_veiculo + faixa_etaria + sexo",
                "anos": [int(a) for a in (anos or [])],
                "quality": {
                    "total_obitos": int(total_obitos or 0),
                    "linhas": int(linhas or 0),
                },
                "data_extracao_min": extracao_min.isoformat() if extracao_min is not None else None,
                "data_extracao_max": extracao_max.isoformat() if extracao_max is not None else None,
                "path": str(path.relative_to(settings.project_root)),
            }
        )
    return {
        "catalog_version": "sim_prelim_v1",
        "scope": "SIM preliminar (PRELIM/DORES) — camada complementar, nunca unida a consolidada",
        "datasets": datasets,
        "aviso_preliminar": {
            "preliminar": True,
            "data_extracao": max(
                (d["data_extracao_max"] for d in datasets if d.get("data_extracao_max")),
                default=None,
            ),
            "completude_estimada": None,
            "texto": _AVISO_TEXTO,
        },
    }
