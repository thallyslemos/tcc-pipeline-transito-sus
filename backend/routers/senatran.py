"""Consulta pública da frota municipal validada da SENATRAN."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from ..config import settings
from ..database import get_connection

router = APIRouter(prefix="/api/senatran", tags=["SENATRAN"])

_PRODUCTS = {
    "total": "frota_municipio_ano.parquet",
    "tipo": "frota_municipio_ano_tipo.parquet",
}


def _source(product: str) -> str:
    if settings.use_postgres and settings.database_url:
        raise HTTPException(
            status_code=503,
            detail="A consulta SENATRAN local requer o backend DuckDB nesta fase",
        )
    path = settings.resolve(settings.gold_dir) / _PRODUCTS[product]
    if not path.exists():
        raise HTTPException(
            status_code=503,
            detail="Gold SENATRAN indisponível; execute o ETL independente de frota",
        )
    escaped = str(path).replace("'", "''")
    return f"read_parquet('{escaped}')"


def _safe_text(value: str) -> str:
    return value.strip().replace("'", "''")


def _canonical_code(value: str) -> str:
    code = "".join(character for character in value if character.isdigit())
    if len(code) != 7:
        raise HTTPException(status_code=422, detail="Código IBGE deve ter sete dígitos")
    return code


@router.get("/metadata")
async def metadata() -> dict:
    """Contrato metodológico e disponibilidade da frota."""
    con = get_connection()
    source = _source("total")
    start, end, rows, municipalities = con.sql(
        f"""
        SELECT MIN(ano), MAX(ano), COUNT(*), COUNT(DISTINCT cod_mun_ibge)
        FROM {source}
        """
    ).fetchone()
    return {
        "fonte": "SENATRAN/RENAVAM",
        "pagina_oficial": (
            "https://www.gov.br/transportes/pt-br/assuntos/transito/"
            "conteudo-Senatran/estatisticas-frota-de-veiculos-senatran"
        ),
        "periodo": {"inicio": int(start), "fim": int(end)},
        "referencia_temporal": "estoque registrado em dezembro de cada ano",
        "grao_gold_total": "municipio IBGE de sete digitos e ano",
        "grao_gold_tipo": "municipio IBGE de sete digitos, ano e tipo SENATRAN",
        "linhas_gold_total": int(rows),
        "municipios": int(municipalities),
        "grupo_duas_rodas_motorizadas": ["MOTOCICLETA", "MOTONETA", "CICLOMOTOR"],
        "ressalva": (
            "Frota registrada é proxy de exposição. Categoria da frota SENATRAN "
            "não equivale à categoria da vítima derivada da CID-10 no SIM."
        ),
    }


@router.get("/anos")
async def anos() -> dict:
    con = get_connection()
    rows = con.sql(f"SELECT DISTINCT ano FROM {_source('total')} ORDER BY ano").fetchall()
    return {"anos": [int(row[0]) for row in rows], "mes_referencia": 12}


@router.get("/tipos")
async def tipos() -> dict:
    con = get_connection()
    rows = con.sql(
        f"""
        SELECT tipo_veiculo_codigo, MAX(tipo_veiculo_senatran) AS rotulo
        FROM {_source("tipo")}
        GROUP BY 1 ORDER BY 2
        """
    ).fetchall()
    return {"tipos": [{"codigo": str(code), "rotulo": str(label)} for code, label in rows]}


@router.get("/municipios")
async def municipios(
    ano: int = Query(..., ge=2000, le=2100),
    uf: str | None = Query(None, min_length=2, max_length=2),
    search: str | None = Query(None, max_length=120),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
) -> dict:
    """Lista paginada no grão município-ano, sem agregar estoques de anos distintos."""
    clauses = [f"ano = {ano}"]
    if uf:
        clauses.append(f"uf = '{_safe_text(uf.upper())}'")
    if search and (term := _safe_text(search)):
        clauses.append(
            f"(LOWER(municipio_ibge) LIKE LOWER('%{term}%') OR cod_mun_ibge LIKE '%{term}%')"
        )
    where = " AND ".join(clauses)
    source = _source("total")
    con = get_connection()
    total = con.sql(f"SELECT COUNT(*) FROM {source} WHERE {where}").fetchone()[0]
    offset = (page - 1) * page_size
    rows = (
        con.sql(
            f"""
            SELECT cod_mun_ibge, municipio_ibge AS municipio, uf, ano,
                   frota_total,
                   AUTOMOVEL AS automovel,
                   MOTOCICLETA AS motocicleta,
                   MOTONETA AS motoneta,
                   CICLOMOTOR AS ciclomotor,
                   frota_duas_rodas_motorizadas,
                   source_sha256
            FROM {source}
            WHERE {where}
            ORDER BY frota_total DESC, municipio_ibge
            LIMIT {page_size} OFFSET {offset}
            """
        )
        .fetchdf()
        .to_dict(orient="records")
    )
    for row in rows:
        for field in (
            "ano",
            "frota_total",
            "automovel",
            "motocicleta",
            "motoneta",
            "ciclomotor",
            "frota_duas_rodas_motorizadas",
        ):
            row[field] = int(row[field])
    return {
        "fonte": "SENATRAN/RENAVAM",
        "referencia": f"dezembro/{ano}",
        "page": page,
        "page_size": page_size,
        "total": int(total),
        "municipios": rows,
    }


@router.get("/municipio/{cod_mun_ibge}")
async def municipio(cod_mun_ibge: str, ano: int | None = Query(None, ge=2000, le=2100)) -> dict:
    """Série anual e, quando solicitado, composição por tipo de um município."""
    code = _canonical_code(cod_mun_ibge)
    con = get_connection()
    total_source = _source("total")
    series = con.sql(
        f"""
        SELECT ano, municipio_ibge, uf, frota_total, frota_duas_rodas_motorizadas,
               MOTOCICLETA, MOTONETA, CICLOMOTOR, source_sha256
        FROM {total_source}
        WHERE cod_mun_ibge = '{code}'
        ORDER BY ano
        """
    ).fetchall()
    if not series:
        raise HTTPException(status_code=404, detail="Município ausente na Gold SENATRAN")
    composition: list[dict] = []
    if ano is not None:
        rows = con.sql(
            f"""
            SELECT tipo_veiculo_codigo, tipo_veiculo_senatran, quantidade
            FROM {_source("tipo")}
            WHERE cod_mun_ibge = '{code}' AND ano = {ano}
            ORDER BY quantidade DESC, tipo_veiculo_senatran
            """
        ).fetchall()
        composition = [
            {"codigo": str(type_code), "rotulo": str(label), "quantidade": int(quantity)}
            for type_code, label, quantity in rows
        ]
    return {
        "fonte": "SENATRAN/RENAVAM",
        "cod_mun_ibge": code,
        "municipio": str(series[-1][1]),
        "uf": str(series[-1][2]),
        "serie_anual": [
            {
                "ano": int(row[0]),
                "frota_total": int(row[3]),
                "frota_duas_rodas_motorizadas": int(row[4]),
                "motocicleta": int(row[5]),
                "motoneta": int(row[6]),
                "ciclomotor": int(row[7]),
                "source_sha256": str(row[8]),
            }
            for row in series
        ],
        "composicao": composition,
    }
