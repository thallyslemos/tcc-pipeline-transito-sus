"""API de dimensao temporal SIM: serie mensal, dia da semana e outliers de concentracao.

Baseado em ESPEC_DIMENSAO_TEMPORAL.md (secao 4.2). A serie mensal reutiliza os marts
Gold ja existentes (grao mes). Dia da semana e outliers exigem grao diario e por isso
consultam a Silver contratual v2 diretamente (dt_obito), aplicando os mesmos filtros
cientificos usados em /api/sim/fluxos: is_v01_v89=true, qa_status='ok', tipobito_raw='2'.
"""

from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, HTTPException, Query
from scipy import stats

from ..database import get_connection
from .sim_only import _mart_path, _municipio_labels, _silver_source, _source, _text, _where_clauses
from .utils import REGIOES

router = APIRouter(prefix="/api/sim/temporal", tags=["SIM-temporal"])
Role = Literal["ocorrencia", "residencia"]

_SCI_FILTERS = "is_v01_v89 = true AND qa_status = 'ok' AND tipobito_raw = '2'"

_NOTAS_METODOLOGICAS = (
    f"Filtros cientificos aplicados na Silver: {_SCI_FILTERS}. "
    "O SIM registra a data do OBITO, nao a data do sinistro; defasagens entre o "
    "evento e o registro do desfecho podem deslocar a distribuicao observada."
)

_DIA_NOMES = {
    1: "Segunda",
    2: "Terca",
    3: "Quarta",
    4: "Quinta",
    5: "Sexta",
    6: "Sabado",
    7: "Domingo",
}
_DIAS_FIM_SEMANA = (6, 7)
_DIAS_UTEIS = (1, 2, 3, 4, 5)

_DATA_RANGE_MIN = "2010-01-01"
_DATA_RANGE_MAX = "2024-12-31"


def _mun_uf_cols(dimensao: Role) -> tuple[str, str, str]:
    if dimensao == "ocorrencia":
        return "cod_mun_ocorrencia_6", "uf_ocorrencia", "municipio_ocorrencia"
    return "cod_mun_residencia_6", "uf_residencia", "municipio_residencia"


def _periodo(
    ano: int | None, ano_inicio: int | None, ano_fim: int | None
) -> tuple[str, str, int | None, int | None]:
    """Resolve o intervalo de datas do calendario e a clausula de ano_obito."""
    if ano is not None:
        return f"{ano}-01-01", f"{ano}-12-31", ano, ano
    if ano_inicio is not None or ano_fim is not None:
        lo = ano_inicio if ano_inicio is not None else 2010
        hi = ano_fim if ano_fim is not None else lo
        if lo > hi:
            raise HTTPException(status_code=422, detail="ano_inicio deve ser <= ano_fim")
        return f"{lo}-01-01", f"{hi}-12-31", lo, hi
    return _DATA_RANGE_MIN, _DATA_RANGE_MAX, None, None


def _silver_filters(
    *,
    mun_col: str,
    uf_col: str,
    ano_lo: int | None,
    ano_hi: int | None,
    uf: str | None,
    regiao: str | None,
    cod_mun_ibge: str | None,
    tipo_veiculo: str | None,
) -> list[str]:
    clauses = [_SCI_FILTERS, "dt_obito IS NOT NULL", f"{mun_col} IS NOT NULL"]
    if ano_lo is not None:
        clauses.append(f"ano_obito >= {ano_lo}")
    if ano_hi is not None:
        clauses.append(f"ano_obito <= {ano_hi}")
    if uf:
        clauses.append(f"{uf_col} = '{_text(uf.upper())}'")
    if regiao:
        if regiao not in REGIOES:
            raise HTTPException(status_code=422, detail="regiao invalida")
        ufs = ", ".join(f"'{state}'" for state in REGIOES[regiao])
        clauses.append(f"{uf_col} IN ({ufs})")
    if cod_mun_ibge:
        code = "".join(c for c in cod_mun_ibge if c.isdigit())[:6]
        if len(code) != 6:
            raise HTTPException(status_code=422, detail="cod_mun_ibge deve ter 6 ou 7 digitos")
        clauses.append(f"{mun_col} = '{code}'")
    if tipo_veiculo:
        cleaned = _text(tipo_veiculo)
        if cleaned:
            clauses.append(f"tipo_veiculo = '{cleaned}'")
    return clauses


# ---------------------------------------------------------------------------
# Serie mensal
# ---------------------------------------------------------------------------


@router.get("/serie-mensal")
async def serie_mensal(
    dimensao: Role = Query("ocorrencia"),
    ano: int | None = Query(None, ge=1900, le=2100),
    ano_inicio: int | None = Query(None, ge=1900, le=2100),
    ano_fim: int | None = Query(None, ge=1900, le=2100),
    uf: str | None = Query(None, min_length=2, max_length=2),
    regiao: str | None = Query(None),
    cod_mun_ibge: str | None = Query(None, min_length=6, max_length=7),
    tipo_veiculo: str | None = Query(None, max_length=80),
) -> dict:
    """Serie mensal de obitos com indicadores de concentracao temporal.

    Grao mes, servido diretamente dos marts Gold (nao exige reprocessamento).
    """
    path = _mart_path(dimensao)
    con = get_connection()
    source = _source(path)
    clauses = _where_clauses(
        ano=ano, ano_inicio=ano_inicio, ano_fim=ano_fim, uf=uf, regiao=regiao, tipo_veiculo=tipo_veiculo
    )
    if cod_mun_ibge:
        code = "".join(c for c in cod_mun_ibge if c.isdigit())[:6]
        if len(code) != 6:
            raise HTTPException(status_code=422, detail="cod_mun_ibge deve ter 6 ou 7 digitos")
        clauses.append(f"cod_mun_ibge_6 = '{code}'")
    where = " AND ".join(clauses)

    rows = con.sql(
        f"""
        SELECT strftime(CAST(competencia AS DATE), '%Y-%m') AS competencia,
               SUM(total_obitos) AS obitos
        FROM {source} WHERE {where}
        GROUP BY 1 ORDER BY 1
        """
    ).fetchall()
    pontos = [{"competencia": str(c), "obitos": int(o)} for c, o in rows]

    total = sum(p["obitos"] for p in pontos)
    meses_com_obito = len(pontos)

    resumo: dict = {
        "total_obitos": total,
        "media_mensal": None,
        "desvio_mensal": None,
        "mes_pico": None,
        "share_mes_pico": None,
        "meses_com_obito": meses_com_obito,
        "hhi_mensal": None,
        "classe_concentracao": None,
        "alerta": False,
    }
    if pontos:
        valores = [p["obitos"] for p in pontos]
        media = sum(valores) / len(valores)
        variancia = sum((v - media) ** 2 for v in valores) / len(valores)
        desvio = variancia**0.5
        pico = max(pontos, key=lambda p: p["obitos"])
        share_pico = (pico["obitos"] / total) if total else 0.0
        hhi = sum((v / total) ** 2 for v in valores) if total else 0.0
        classe = "concentrado" if (share_pico >= 0.5 or meses_com_obito <= 2) else "difuso"
        z_pico = ((pico["obitos"] - media) / desvio) if desvio > 0 else 0.0
        resumo.update(
            {
                "media_mensal": round(media, 2),
                "desvio_mensal": round(desvio, 2),
                "mes_pico": pico["competencia"],
                "share_mes_pico": round(share_pico, 4),
                "hhi_mensal": round(hhi, 4),
                "classe_concentracao": classe,
                "alerta": bool(z_pico >= 2.0),
            }
        )

    return {
        "fonte": "SIM",
        "dimensao": dimensao,
        "pontos": pontos,
        "resumo": resumo,
        "filtros": {
            "ano": ano,
            "ano_inicio": ano_inicio,
            "ano_fim": ano_fim,
            "uf": uf,
            "regiao": regiao,
            "cod_mun_ibge": cod_mun_ibge,
            "tipo_veiculo": tipo_veiculo,
        },
        "notas_metodologicas": (
            "Serie servida do mart Gold mensal (grao competencia). classe_concentracao "
            "usa apenas o grao mensal ('concentrado' se share_mes_pico >= 0,50 ou "
            "meses_com_obito <= 2); a classe 'evento_unico' (grao diario) e reportada em "
            "/api/sim/temporal/outliers."
        ),
    }


# ---------------------------------------------------------------------------
# Dia da semana
# ---------------------------------------------------------------------------


@router.get("/dia-semana")
async def dia_semana(
    dimensao: Role = Query("ocorrencia"),
    ano: int | None = Query(None, ge=1900, le=2100),
    ano_inicio: int | None = Query(None, ge=1900, le=2100),
    ano_fim: int | None = Query(None, ge=1900, le=2100),
    uf: str | None = Query(None, min_length=2, max_length=2),
    regiao: str | None = Query(None),
    cod_mun_ibge: str | None = Query(None, min_length=6, max_length=7),
    tipo_veiculo: str | None = Query(None, max_length=80),
) -> dict:
    """Distribuicao de obitos por dia da semana, com teste qui-quadrado de aderencia.

    O denominador de cada dia da semana e o numero real de ocorrencias daquele dia
    no calendario do periodo selecionado (nunca 1/7 do total), pois anos tem
    quantidades desiguais de cada dia da semana.
    """
    mun_col, uf_col, _ = _mun_uf_cols(dimensao)
    date_start, date_end, ano_lo, ano_hi = _periodo(ano, ano_inicio, ano_fim)

    con = get_connection()
    source = _silver_source()
    clauses = _silver_filters(
        mun_col=mun_col,
        uf_col=uf_col,
        ano_lo=ano_lo,
        ano_hi=ano_hi,
        uf=uf,
        regiao=regiao,
        cod_mun_ibge=cod_mun_ibge,
        tipo_veiculo=tipo_veiculo,
    )
    where = " AND ".join(clauses)

    obs_rows = con.sql(
        f"""
        SELECT CAST(isodow(dt_obito) AS INTEGER) AS dia_semana, COUNT(*) AS obitos
        FROM {source}
        WHERE {where}
        GROUP BY 1
        """
    ).fetchall()
    obs = {int(d): int(o) for d, o in obs_rows}
    total_obitos = sum(obs.values())

    cal_rows = con.sql(
        f"""
        SELECT CAST(isodow(d) AS INTEGER) AS dia_semana, COUNT(*) AS dias
        FROM generate_series(DATE '{date_start}', DATE '{date_end}', INTERVAL 1 DAY) t(d)
        GROUP BY 1
        """
    ).fetchall()
    dias_cal = {int(d): int(n) for d, n in cal_rows}
    total_dias = sum(dias_cal.values())
    media_geral = (total_obitos / total_dias) if total_dias else 0.0

    distribuicao = []
    for d in range(1, 8):
        o = obs.get(d, 0)
        dias = dias_cal.get(d, 0)
        media = (o / dias) if dias else 0.0
        indice = (media / media_geral) if media_geral else 0.0
        distribuicao.append(
            {
                "dia_semana": d,
                "dia_semana_nome": _DIA_NOMES[d],
                "obitos": o,
                "dias_no_calendario": dias,
                "media_por_dia": round(media, 4),
                "proporcao_observada": round(o / total_obitos, 4) if total_obitos else 0.0,
                "indice": round(indice, 4),
            }
        )

    fds_obitos = sum(obs.get(d, 0) for d in _DIAS_FIM_SEMANA)
    fds_dias = sum(dias_cal.get(d, 0) for d in _DIAS_FIM_SEMANA)
    du_obitos = sum(obs.get(d, 0) for d in _DIAS_UTEIS)
    du_dias = sum(dias_cal.get(d, 0) for d in _DIAS_UTEIS)
    media_fds = (fds_obitos / fds_dias) if fds_dias else 0.0
    media_du = (du_obitos / du_dias) if du_dias else 0.0
    razao_fim_semana = (media_fds / media_du) if media_du else None

    qui_quadrado: dict = {"estatistica": None, "gl": 6, "p_valor": None, "significativo_005": None}
    if total_obitos > 0 and total_dias > 0:
        observados = [obs.get(d, 0) for d in range(1, 8)]
        esperados = [total_obitos * dias_cal.get(d, 0) / total_dias for d in range(1, 8)]
        if all(e > 0 for e in esperados):
            estat = float(sum((o - e) ** 2 / e for o, e in zip(observados, esperados, strict=True)))
            p_valor = float(stats.chi2.sf(estat, df=6))
            qui_quadrado = {
                "estatistica": round(estat, 4),
                "gl": 6,
                "p_valor": round(p_valor, 6),
                "significativo_005": bool(p_valor < 0.05),
            }

    return {
        "fonte": "SIM",
        "dimensao": dimensao,
        "periodo": {"inicio": date_start, "fim": date_end},
        "total_obitos": total_obitos,
        "distribuicao": distribuicao,
        "fim_de_semana": {
            "obitos": fds_obitos,
            "dias_calendario": fds_dias,
            "media_por_dia": round(media_fds, 4),
            "proporcao_observada": round(fds_obitos / total_obitos, 4) if total_obitos else 0.0,
            "proporcao_esperada_calendario": round(fds_dias / total_dias, 4) if total_dias else 0.0,
        },
        "dia_util": {
            "obitos": du_obitos,
            "dias_calendario": du_dias,
            "media_por_dia": round(media_du, 4),
            "proporcao_observada": round(du_obitos / total_obitos, 4) if total_obitos else 0.0,
            "proporcao_esperada_calendario": round(du_dias / total_dias, 4) if total_dias else 0.0,
        },
        "razao_fim_semana": round(razao_fim_semana, 4) if razao_fim_semana is not None else None,
        "qui_quadrado": qui_quadrado,
        "filtros": {
            "ano": ano,
            "ano_inicio": ano_inicio,
            "ano_fim": ano_fim,
            "uf": uf,
            "regiao": regiao,
            "cod_mun_ibge": cod_mun_ibge,
            "tipo_veiculo": tipo_veiculo,
        },
        "notas_metodologicas": (
            f"{_NOTAS_METODOLOGICAS} Denominador de cada dia da semana: numero real de "
            "ocorrencias daquele dia no calendario do periodo (nao 1/7 do total). "
            "Qui-quadrado de aderencia: H0 = distribuicao observada proporcional ao "
            "numero de dias de cada tipo no calendario (nao a uniformidade ingenua)."
        ),
    }


# ---------------------------------------------------------------------------
# Outliers de concentracao (caso Gaviao)
# ---------------------------------------------------------------------------


@router.get("/outliers")
async def outliers(
    dimensao: Role = Query("ocorrencia"),
    ano: int | None = Query(None, ge=1900, le=2100),
    ano_inicio: int | None = Query(None, ge=1900, le=2100),
    ano_fim: int | None = Query(None, ge=1900, le=2100),
    uf: str | None = Query(None, min_length=2, max_length=2),
    regiao: str | None = Query(None),
    tipo_veiculo: str | None = Query(None, max_length=80),
    min_obitos: int = Query(10, ge=1),
    somente_concentrados: bool = Query(True),
) -> dict:
    """Classifica municipio-ano por concentracao temporal (evento_unico/concentrado/difuso).

    Detecta o padrao do caso Gaviao: taxas anuais dominadas por um unico dia ou mes,
    que nao devem ser lidas como risco viario persistente.
    """
    mun_col, uf_col, mun_name_col = _mun_uf_cols(dimensao)
    _, _, ano_lo, ano_hi = _periodo(ano, ano_inicio, ano_fim)

    con = get_connection()
    source = _silver_source()
    clauses = _silver_filters(
        mun_col=mun_col,
        uf_col=uf_col,
        ano_lo=ano_lo,
        ano_hi=ano_hi,
        uf=uf,
        regiao=regiao,
        cod_mun_ibge=None,
        tipo_veiculo=tipo_veiculo,
    )
    where = " AND ".join(clauses)

    rows = con.sql(
        f"""
        WITH base AS (
            SELECT {mun_col} AS cod_mun, {mun_name_col} AS municipio, {uf_col} AS uf,
                   ano_obito AS ano, dt_obito
            FROM {source}
            WHERE {where}
        ),
        dia AS (
            SELECT cod_mun, ano, dt_obito, COUNT(*) AS n
            FROM base GROUP BY 1, 2, 3
        ),
        dia_pico AS (
            SELECT cod_mun, ano, MAX(n) AS obitos_dia_pico
            FROM dia GROUP BY 1, 2
        ),
        mes AS (
            SELECT cod_mun, ano, DATE_TRUNC('month', dt_obito) AS mes, COUNT(*) AS n
            FROM base GROUP BY 1, 2, 3
        ),
        mes_agg AS (
            SELECT cod_mun, ano, MAX(n) AS obitos_mes_pico, COUNT(*) AS meses_com_obito
            FROM mes GROUP BY 1, 2
        ),
        anual AS (
            SELECT cod_mun, MAX(municipio) AS municipio, MAX(uf) AS uf, ano,
                   COUNT(*) AS obitos_ano
            FROM base GROUP BY 1, 4
        )
        SELECT a.cod_mun, a.municipio, a.uf, a.ano, a.obitos_ano,
               m.obitos_mes_pico, m.meses_com_obito, d.obitos_dia_pico
        FROM anual a
        JOIN mes_agg m ON m.cod_mun = a.cod_mun AND m.ano = a.ano
        JOIN dia_pico d ON d.cod_mun = a.cod_mun AND d.ano = a.ano
        WHERE a.obitos_ano >= {min_obitos}
        ORDER BY a.ano, a.obitos_ano DESC
        """
    ).fetchall()

    labels = _municipio_labels(con)
    pop_path = None
    try:
        from ..config import settings

        pop_candidate = settings.resolve("data/ibge_populacao.parquet")
        if pop_candidate.exists():
            pop_path = str(pop_candidate).replace("'", "''")
    except Exception:
        pop_path = None

    populacao_por_mun_ano: dict[tuple[str, int], int] = {}
    if pop_path and rows:
        pop_rows = con.sql(
            f"""
            SELECT LEFT(cod_mun_ibge, 6) AS cod_mun, ano, MAX(populacao) AS populacao
            FROM read_parquet('{pop_path}')
            GROUP BY 1, 2
            """
        ).fetchall()
        populacao_por_mun_ano = {(str(c), int(a)): int(p) for c, a, p in pop_rows if p is not None}

    municipios = []
    for cod_mun, municipio, uf_val, ano_val, obitos_ano, obitos_mes_pico, meses_com_obito, obitos_dia_pico in rows:
        obitos_ano = int(obitos_ano)
        share_mes_pico = (obitos_mes_pico / obitos_ano) if obitos_ano else 0.0
        share_dia_pico = (obitos_dia_pico / obitos_ano) if obitos_ano else 0.0
        if share_dia_pico >= 0.5:
            classe = "evento_unico"
        elif share_mes_pico >= 0.5 or meses_com_obito <= 2:
            classe = "concentrado"
        else:
            classe = "difuso"

        label = labels.get(str(cod_mun), {})
        populacao = populacao_por_mun_ano.get((str(cod_mun), int(ano_val)))
        taxa_100mil = (obitos_ano * 100000.0 / populacao) if populacao else None

        municipios.append(
            {
                "cod_mun_ibge": str(cod_mun),
                "municipio": str(municipio or label.get("municipio") or ""),
                "uf": str(uf_val or label.get("uf") or ""),
                "ano": int(ano_val),
                "obitos_ano": obitos_ano,
                "populacao": populacao,
                "taxa_100mil": round(taxa_100mil, 2) if taxa_100mil is not None else None,
                "meses_com_obito": int(meses_com_obito),
                "share_mes_pico": round(share_mes_pico, 4),
                "share_dia_pico": round(share_dia_pico, 4),
                "classe_concentracao": classe,
            }
        )

    if somente_concentrados:
        municipios = [m for m in municipios if m["classe_concentracao"] != "difuso"]

    municipios.sort(key=lambda m: (m["share_dia_pico"], m["obitos_ano"]), reverse=True)

    return {
        "fonte": "SIM",
        "dimensao": dimensao,
        "municipios": municipios,
        "filtros": {
            "ano": ano,
            "ano_inicio": ano_inicio,
            "ano_fim": ano_fim,
            "uf": uf,
            "regiao": regiao,
            "tipo_veiculo": tipo_veiculo,
            "min_obitos": min_obitos,
            "somente_concentrados": somente_concentrados,
        },
        "notas_metodologicas": (
            f"{_NOTAS_METODOLOGICAS} Grao municipio-ano, min_obitos={min_obitos}. "
            "classe_concentracao: evento_unico se share_dia_pico >= 0,50; concentrado se "
            "share_mes_pico >= 0,50 ou meses_com_obito <= 2; caso contrario difuso. "
            "Taxa por 100 mil so disponivel nos anos com populacao IBGE no artefato local."
        ),
    }
