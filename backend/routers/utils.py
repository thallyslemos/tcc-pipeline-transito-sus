"""Funções utilitárias compartilhadas entre os routers."""

import math
from enum import StrEnum

REGIOES = {
    "Norte": ["AC", "AP", "AM", "PA", "RO", "RR", "TO"],
    "Nordeste": ["AL", "BA", "CE", "MA", "PB", "PE", "PI", "RN", "SE"],
    "Sudeste": ["ES", "MG", "RJ", "SP"],
    "Sul": ["PR", "RS", "SC"],
    "Centro-Oeste": ["DF", "GO", "MT", "MS"],
}


class Dimensao(StrEnum):
    ocorrencia = "ocorrencia"
    residencia = "residencia"


class Regiao(StrEnum):
    norte = "Norte"
    nordeste = "Nordeste"
    sudeste = "Sudeste"
    sul = "Sul"
    centro_oeste = "Centro-Oeste"


def _sanitize_floats(rows: list[dict]) -> list[dict]:
    """Substitui float nan por None para serializacao JSON."""
    for r in rows:
        for k, v in r.items():
            if isinstance(v, float) and (math.isnan(v) or math.isinf(v)):
                r[k] = None
    return rows


def _has_view(con, view_name: str) -> bool:
    """Verifica se uma view existe (DuckDB: DESCRIBE; PostgreSQL: information_schema)."""
    if hasattr(con, "has_relation"):
        return con.has_relation(view_name)
    try:
        con.sql(f"DESCRIBE {view_name}")
        return True
    except Exception:
        return False


def _ibge_municipios_join(con, table_alias: str = "o") -> str:
    """LEFT JOIN com cadastro IBGE (nome e UF canônicos) quando a view existir."""
    if not _has_view(con, "v_ibge_municipios"):
        return ""
    return (
        f"LEFT JOIN v_ibge_municipios ibge "
        f"ON LEFT({table_alias}.cod_mun_ibge, 6) = LEFT(ibge.cod_mun_ibge, 6)"
    )


def _ibge_label_exprs(con, table_alias: str = "o") -> tuple[str, str]:
    """SQL para nome/UF de exibição; evita MAX(uf) com UF errada vinda do SIM."""
    if _has_view(con, "v_ibge_municipios"):
        return (
            f"COALESCE(MAX(ibge.nome), MAX({table_alias}.municipio))",
            f"COALESCE(MAX(ibge.uf), MAX({table_alias}.uf))",
        )
    return (f"MAX({table_alias}.municipio)", f"MAX({table_alias}.uf)")


def _where(
    ano: int | None = None,
    mun: str | None = None,
    veiculo: str | None = None,
    uf: str | None = None,
    regiao: Regiao | None = None,
) -> str:
    """Monta clausula WHERE dinamica."""
    clauses = []
    if ano is not None:
        clauses.append(f"ano = {ano}")
    if mun:
        clauses.append(f"cod_mun_ibge = '{mun}'")
    if veiculo:
        clauses.append(f"tipo_veiculo = '{veiculo}'")
    if uf:
        clauses.append(f"uf = '{uf}'")
    if regiao:
        ufs_in_region = REGIOES[regiao.value]
        clauses.append(f"uf IN {tuple(ufs_in_region)}")

    return ("WHERE " + " AND ".join(clauses)) if clauses else ""


def _where_and(
    ano: int | None = None,
    mun: str | None = None,
    veiculo: str | None = None,
    uf: str | None = None,
    regiao: Regiao | None = None,
    table_alias: str | None = None,
    *,
    uf_expr: str | None = None,
) -> str:
    """Monta filtro como AND para queries com WHERE 1=1.

    uf_expr: expressão SQL completa para filtro geográfico (ex.: COALESCE(ibge.uf, o.uf))
    quando o rótulo canônico vem do IBGE; padrão: {alias}.uf
    """
    pref = f"{table_alias}." if table_alias else ""
    uf_sql = uf_expr if uf_expr is not None else f"{pref}uf"
    clauses = []
    if ano is not None:
        clauses.append(f"AND {pref}ano = {ano}")
    if mun:
        clauses.append(f"AND {pref}cod_mun_ibge = '{mun}'")
    if veiculo:
        clauses.append(f"AND {pref}tipo_veiculo = '{veiculo}'")
    if uf:
        clauses.append(f"AND {uf_sql} = '{uf}'")
    if regiao:
        ufs_in_region = REGIOES[regiao.value]
        clauses.append(f"AND {uf_sql} IN {tuple(ufs_in_region)}")

    return " ".join(clauses)
