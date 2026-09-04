"""Funções utilitárias compartilhadas entre os routers."""

import math
import re
from enum import StrEnum

REGIOES = {
    "Norte": ["AC", "AP", "AM", "PA", "RO", "RR", "TO"],
    "Nordeste": ["AL", "BA", "CE", "MA", "PB", "PE", "PI", "RN", "SE"],
    "Sudeste": ["ES", "MG", "RJ", "SP"],
    "Sul": ["PR", "RS", "SC"],
    "Centro-Oeste": ["DF", "GO", "MT", "MS"],
}

ALL_UFS: frozenset[str] = frozenset(uf for ufs in REGIOES.values() for uf in ufs)
_COD6_RE = re.compile(r"^\d{6}$")
_UF_RE = re.compile(r"^[A-Za-z]{2}$")


class Dimensao(StrEnum):
    ocorrencia = "ocorrencia"
    residencia = "residencia"


class Regiao(StrEnum):
    norte = "Norte"
    nordeste = "Nordeste"
    sudeste = "Sudeste"
    sul = "Sul"
    centro_oeste = "Centro-Oeste"


def _escape_sql_literal(value: str) -> str:
    """Escapa aspas simples para uso seguro dentro de literais SQL interpolados."""
    return value.replace("'", "''")


def _literal_sql(value: str) -> str:
    return f"'{_escape_sql_literal(value)}'"


def cod6_seguro(cod_mun: str) -> str | None:
    """Retorna código IBGE de 6 dígitos ou None se inválido."""
    cod6 = "".join(c for c in cod_mun.strip()[:7] if c.isdigit())
    return cod6 if _COD6_RE.match(cod6) else None


def uf_seguro(uf: str) -> str | None:
    """Valida sigla UF contra a lista oficial."""
    raw = uf.strip().upper()
    if not _UF_RE.match(raw):
        return None
    return raw if raw in ALL_UFS else None


def regiao_segura(regiao: str) -> str | None:
    title = regiao.strip().title()
    return title if title in REGIOES else None


def dimensao_segura(dim: str) -> str:
    d = dim.strip().lower()
    return d if d in ("ocorrencia", "residencia") else "ocorrencia"


def texto_busca_seguro(value: str, *, max_len: int = 80) -> str | None:
    """Texto para ILIKE sem wildcards SQL."""
    cleaned = "".join(c for c in value.strip() if c.isalnum() or c in " -.")
    cleaned = cleaned[:max_len].strip()
    return cleaned or None


def ilike_clause(column: str, value: str | None, *, max_len: int = 80) -> str | None:
    term = texto_busca_seguro(value, max_len=max_len) if value else None
    if not term:
        return None
    return f"{column} ILIKE '%{_escape_sql_literal(term)}%'"


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


def _mun_clause(field: str, mun: str) -> str:
    cod = cod6_seguro(mun)
    value = cod if cod else mun
    return f"{field} = {_literal_sql(value)}"


def _uf_clause(field: str, uf: str) -> str | None:
    safe = uf_seguro(uf)
    if not safe:
        return None
    return f"{field} = {_literal_sql(safe)}"


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
        clauses.append(_mun_clause("cod_mun_ibge", mun))
    if veiculo:
        clauses.append(f"tipo_veiculo = {_literal_sql(veiculo)}")
    if uf:
        uf_part = _uf_clause("uf", uf)
        if uf_part:
            clauses.append(uf_part)
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
    """Monta filtro como AND para queries com WHERE 1=1."""
    pref = f"{table_alias}." if table_alias else ""
    uf_sql = uf_expr if uf_expr is not None else f"{pref}uf"
    clauses = []
    if ano is not None:
        clauses.append(f"AND {pref}ano = {ano}")
    if mun:
        clauses.append(f"AND {_mun_clause(f'{pref}cod_mun_ibge', mun)}")
    if veiculo:
        clauses.append(f"AND {pref}tipo_veiculo = {_literal_sql(veiculo)}")
    if uf:
        uf_part = _uf_clause(uf_sql, uf)
        if uf_part:
            clauses.append(f"AND {uf_part}")
    if regiao:
        ufs_in_region = REGIOES[regiao.value]
        clauses.append(f"AND {uf_sql} IN {tuple(ufs_in_region)}")

    return " ".join(clauses)
