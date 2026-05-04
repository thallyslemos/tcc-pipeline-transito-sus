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
    """Verifica se uma view existe no DuckDB."""
    try:
        con.sql(f"DESCRIBE {view_name}")
        return True
    except Exception:
        return False


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
) -> str:
    """Monta filtro como AND para queries com WHERE 1=1."""
    clauses = []
    if ano is not None:
        clauses.append(f"AND ano = {ano}")
    if mun:
        clauses.append(f"AND cod_mun_ibge = '{mun}'")
    if veiculo:
        clauses.append(f"AND tipo_veiculo = '{veiculo}'")
    if uf:
        clauses.append(f"AND uf = '{uf}'")
    if regiao:
        ufs_in_region = REGIOES[regiao.value]
        clauses.append(f"AND uf IN {tuple(ufs_in_region)}")

    return " ".join(clauses)
