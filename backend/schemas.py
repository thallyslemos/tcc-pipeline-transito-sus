"""Schemas Pydantic para validação de respostas da API."""

from datetime import date
from decimal import Decimal

from pydantic import BaseModel


class ObitoMunicipio(BaseModel):
    """Óbitos por acidente de trânsito agregados por município/mês."""

    cod_mun_ibge: str
    municipio: str
    uf: str
    competencia: date
    ano: int
    mes: int
    total_obitos: int
    tipo_veiculo: str
    faixa_etaria: str
    sexo: str


class CustoMunicipio(BaseModel):
    """Custos ambulatoriais agregados por município/mês."""

    cod_mun_ibge: str
    municipio: str
    uf: str
    competencia: date
    ano: int
    mes: int
    custo_total: Decimal
    total_procedimentos: int
    total_atendimentos: int
    tipo_veiculo: str
    faixa_etaria: str


class KPI(BaseModel):
    """Indicador-chave para o dashboard."""

    label: str
    valor: float | int
    variacao_pct: float | None = None
    periodo: str


class SerieTemporalItem(BaseModel):
    """Ponto de uma série temporal."""

    competencia: str
    valor: float


class DashboardSummary(BaseModel):
    """Resumo geral para o dashboard principal."""

    total_obitos: int
    total_custos: float
    total_atendimentos: int
    municipios: int
    periodo: str
    obitos_por_ano: list[dict]
    custos_por_ano: list[dict]
    obitos_por_tipo_veiculo: list[dict]
    custos_por_tipo_veiculo: list[dict]
    obitos_por_municipio: list[dict]
    custos_por_municipio: list[dict]
    serie_temporal_obitos: list[dict]
    serie_temporal_custos: list[dict]
    obitos_por_faixa_etaria: list[dict]
    obitos_por_sexo: list[dict]
