#!/usr/bin/env python3
"""
Gerador de Resumo de Conhecimentos e Fontes
============================================
Produz um documento estructurado com todas as fontes de dados,
conceitos descobertos, campos importantes e possibilidades de cruzamento
para o projeto tcc-pipeline-transito-sus.

Uso:
    python scripts/gerar_resumo_conhecimento.py

Saída: /opt/team-shared/resumo_conhecimento_<YYYYMMDD>.md
"""

import re
from pathlib import Path
from datetime import date

# ── Configuração ──────────────────────────────────────────────────────────────

PROJECT_ROOT = Path("/workspace/tcc")
OUTPUT_DIR   = Path("/opt/team-shared")
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

TODAY = date.today().strftime("%Y%m%d")

# ── Fontes já integradas ───────────────────────────────────────────────────────

FONTES_INTEGRADAS = {
    "SIM (Sistema de Informações sobre Mortalidade)": {
        "orgao":    "DATASUS / SVS — Ministério da Saúde",
        "url":      "https://datasus.saude.gov.br/transferencia-de-arquivos/",
        "protocolo": "FTP PySUS (.dbc → Parquet)",
        "tabela":   "SIM/DO*",
        "filtro_cid": "V01–V89 (Capítulo XX CID-10 — Acidentes de Transporte Terrestre)",
        "campos_chave": [
            ("CAUSABAS",   "Causa básica do óbito (CID-10) — usar LEFT(CAUSABAS,3) para grupo V01–V89"),
            ("DTOBITO",    "Data do óbito DDMMYYYY — aplicar TRIM + STRPTIME, descartar inválidos"),
            ("CODMUNOCOR", "Código IBGE 7 dígitos do município de OCORRÊNCIA do óbito (local do sinistro)"),
            ("CODMUNRES",  "Código IBGE 7 dígitos do município de RESIDÊNCIA da vítima"),
            ("SEXO",       "1=Masculino, 2=Feminino — aplicar CAST(TRIM())"),
            ("IDADE",      "Idade codificada em 3 dígitos — usar função DECODE_IDADE_SIM (anos para >= 1)"),
            ("UF",         "Sigla UF — aplicar TRIM"),
        ],
        "semantica": [
            "CODMUNOCOR ≈ local do acidente (proxy para o local do sinistro)",
            "CODMUNRES  = onde a vítima morava",
            "Para indicadores de segurança viária, usar CODMUNOCOR (local do evento)",
            "Para análises demográficas/de saúde, CODMUNRES revela perfil do residente",
        ],
        "idiossincrasias": [
            "CAUSABAS pode vir com espaços à direita — sempre TRIM()",
            "CODMUNOCOR pode ter 7 ou 8 dígitos (com dígito verificador) — truncar para 7",
            "Registros com DTOBITO null devem ser descartados (perda documentada)",
            "TIPOBITO=1 indica óbito fetal — excluir ou documentar se incluso",
        ],
    },

    "SIA/PA (Sistema de Informações Ambulatoriais — Produção Ambulatorial)": {
        "orgao":    "DATASUS — Ministério da Saúde",
        "url":      "https://datasus.saude.gov.br/transferencia-de-arquivos/",
        "protocolo": "FTP PySUS (.dbc → Parquet)",
        "tabela":   "SIA/PAufaaaa.dbc",
        "filtro_cid": "V01–V89 (mesmo capítulo CID-10)",
        "campos_chave": [
            ("PA_CMP",     "Competência YYYYMM — origem da produção ambulatorial"),
            ("PA_MUNPCN",  "Código IBGE 6 dígitos do município de RESIDÊNCIA do paciente (não confundir com PA_UFMUN)"),
            ("PA_CIDPRI",  "CID primário — TRIM + LEFT(PA_CIDPRI,3) BETWEEN 'V01' AND 'V89'"),
            ("PA_VALAPR",  "Valor APROVADO R$ — usar SEMPRE este, nunca PA_QTDPRO (não aprovado)"),
            ("PA_QTDAPR",  "Quantidade aprovada — quantidade de procedimentos/apresentações autorizadas"),
            ("PA_IDADE",   "Idade codificada — combinar com PA_FLIDADE (1=anos, 2=meses, 3=dias)"),
            ("PA_FLIDADE", "Flag da idade — indica unidade de PA_IDADE"),
            ("PA_SEXO",    "Sexo M/F — aplicar TRIM"),
            ("UF",         "Sigla UF — aplicar TRIM"),
        ],
        "semantica": [
            "PA_MUNPCN = município de residência do paciente (não o local de atendimento)",
            "PA_UFMUN = UF+município do estabelecimento (atendimento) — disponível mas menos usado",
            "PA_VALAPR é o campo financeiramente auditado (TCU 2020 valida superioridade sobre QTDPRO)",
        ],
        "idiossincrasias": [
            "PA_VALAPR vem com espaços e formatação monetária — CAST(TRIM(PA_VALAPR))",
            "PA_MUNPCN é código de 6 dígitos (sem dígito verificador) — complementar com prefixo UF para 7 dígitos",
            "PA_CMP pode variar entre 'YYYYMM', 'AAAAMM' — detectar automaticamente",
            "SIA não tem campo direto de sexo/idade? — verificar PA_FLIDADE para interpretar PA_IDADE",
        ],
        "referencia_financeiro": "docs/FINANCEIRO.md — metodologia TCU para detecção de anomalias em PA_QTDAPR/VALAPR",
    },

    "IBGE — Códigos e Localidades": {
        "orgao":    "IBGE",
        "url":      "https://www.ibge.gov.br/explica/codigos-dos-municipios.php",
        "protocolo": "CSV download + API HTTP",
        "campos_chave": [
            ("Código Município Completo (7d)", "Código IBGE com dígito verificador — usar para JOIN com SIM/SIA"),
            ("Município (6d)",                "Código sem dígito — usar para JOIN parcial com PA_MUNPCN (6d)"),
            ("Nome_Município",               "Nome oficial do município"),
            ("UF",                            "Código numérico da UF (ex: 29 = BA)"),
            ("Nome_UF",                       "Nome por extenso"),
            ("Região Geográfica Intermediária", "Código IBGE 2017 da região intermediária"),
            ("Nome Região Geográfica Intermediária", "Nome da região intermediária"),
            ("Região Geográfica Imediata",   "Código IBGE 2017 da região imediata"),
            ("Nome Região Geográfica Imediata",  "Nome da região imediata"),
        ],
        "enriquecimentos_disponiveis": [
            "lat/lon via API: servicodados.ibge.gov.br/api/v1/localidades/municipios/{cod}/coordenadas",
            "area_km2 via SIDRA tabela 4714 (Censo 2022)",
            "população via SIDRA tabela 6579 (estimativas anuais)",
            "densidade demográfica via SIDRA tabela 4714",
        ],
        "hierarquia": "UF → Região Intermediária (2017) → Região Imediata (2017) → Município",
    },

    "DENATRAN/RENAVAM — Frota de Veículos": {
        "orgao":    "DENATRAN / Ministério dos Transportes",
        "url":      "https://dados.transportes.gov.br/dataset/renavam",
        "protocolo": "Download CSV direto (requer autenticação básica ou link público)",
        "campos_chave": [
            ("uf",           "Sigla UF"),
            ("municipio",    "Nome do município (normalizar upper-case)"),
            ("cod_municipio","Código IBGE 7 dígitos — principal chave de JOIN"),
            ("tipo_veiculo", "Categoria: AUTOMOVEL, MOTOCICLETA, CAMINHÃO, ÔNIBUS, etc."),
            ("quantidade",   "Quantidade de veículos registrados"),
            ("mes_referencia","Mês de referência da informação"),
            ("ano_referencia","Ano de referência"),
        ],
        "tipos_veiculo_conhecidos": [
            "AUTOMOVEL", "MOTOCICLETA", "CAMINHÃO", "ÔNIBUS",
            "UTILITÁRIO", "MICROÔNIBUS", "CAMIONETA", "TRATOR",
        ],
        "uso_estrategico": [
            "Denominador para taxa de mortalidade por 10k veículos (mais precisa que taxa por 100mil hab)",
            "Cruzamento com obitos por tipo de veículo (motociclista = maior risco)",
            "Evolução da frota por município ao longo dos anos (análise de tendência)",
            "Identificar municípios com alta sinistralidade relativa à frota",
        ],
        "query_referencia": """
-- Taxa de mortalidade por 10k veículos (ADR-002)
SELECT
    m.nome AS municipio,
    o.ano,
    SUM(o.quantidade) AS total_obitos,
    SUM(f.quantidade) AS total_frota,
    (SUM(o.quantidade)::DECIMAL / NULLIF(SUM(f.quantidade), 0)) * 10000
        AS taxa_por_10k_veiculos
FROM fato_obitos o
JOIN dim_municipio m ON o.cod_mun_ibge_7 = m.cod_mun_ibge_7
LEFT JOIN fato_frota f
    ON o.cod_mun_ibge_7 = f.cod_mun_ibge_7
    AND o.ano = f.ano
    AND f.tipo_veiculo = 'TOTAL'
WHERE o.ano = 2023
GROUP BY m.nome, o.ano;
        """,
    },

    "SIDRA — Tabelas IBGE": {
        "tabelas": {
            "6579": {
                "nome":    "Estimativas Populacionais Anuais",
                "url":     "https://sidra.ibge.gov.br/tabela/6579",
                "uso":     "Denominador para taxa por 100mil hab",
                "campos":  "população estimada por município e ano",
            },
            "4714": {
                "nome":    "Área Territorial e Densidade Demográfica (Censo 2022)",
                "url":     "https://sidra.ibge.gov.br/tabela/4714",
                "uso":     "Cálculo de densidade (hab/km²) e enriquecimento geográfico",
                "campos":  "área km², densidade demográfica por município",
            },
            "5938": {
                "nome":    "PIB dos Municípios",
                "url":     "https://sidra.ibge.gov.br/tabela/5938",
                "uso":     "Análise de correlação entre PIB e sinistralidade (futuro)",
                "campos":  "PIB municipal, valor adicionado, impostos",
            },
        },
    },
}

# ── Conceitos-chave descobertos ────────────────────────────────────────────────

CONCEITOS = {
    "Taxa de mortalidade por 10k veículos": {
        "formula":     "(óbitos / frota_total) * 10000",
        "vantagem":    "Mais precisa que taxa por 100mil hab pois usa denominador diretamente relacionado ao risco (mais veículos = mais exposição)",
        "aplicacao":   "Comparar municípios com frotas similares; identificar alta sinistralidade relativa",
        "sql_exemplo": "(SUM(o.quantidade)::decimal / NULLIF(SUM(f.quantidade), 0)) * 10000",
    },

    "CID V01–V89 — Acidentes de Transporte Terrestre": {
        "descricao":  "Capítulo XX do CID-10, códigos V01 a V89, abrangendo todos os modos de transporte terrestre",
        "subgrupos_utilizados": [
            ("V01–V09", "Pedestre"),
            ("V10–V19", "Ciclista"),
            ("V20–V29", "Motociclista"),
            ("V30–V39", "Ocupante de veículo a motor de 3 rodas"),
            ("V40–V49", "Ocupante de automóvel"),
            ("V50–V59", "Ocupante de veículo de transporte público"),
            ("V60–V69", "Ocupante de veículo de transporte de carga"),
            ("V70–V79", "Ocupante de ônibus"),
            ("V80–V89", "Outros (trator, animal, etc.)"),
        ],
        "importante": "Filtrar LEFT(TRIM(cid), 3) BETWEEN 'V01' AND 'V89' — não usar string maior que 3 chars",
        "referencia": "oms / DATASUS / ONSV — todos usam este range",
    },

    "Residência vs Ocorrência": {
        "descricao":  "Dois conceitos fundamentais em análise de acidentes de trânsito",
        "ocorrencia": {
            "campo_sim":   "CODMUNOCOR",
            "significado": "Onde o óbito ocorreu (≈ local do sinistro)",
            "uso":         "Indicadores de segurança viária (hotspots, map，警方)",
        },
        "residencia": {
            "campo_sim":   "CODMUNRES",
            "significado": "Onde a vítima morava",
            "uso":         "Perfil demográfico, planejamento de saúde local",
        },
        "sia": {
            "campo":       "PA_MUNPCN",
            "significado": "Município de residência do paciente (SIA não tem campo de ocorrência)",
            "nota":        "SIA só tem residência do paciente — não confundir com local de atendimento (PA_UFMUN)",
        },
        "impacto_numerico": "Nacionalmente, valores por residência tendem a ser maiores que por ocorrência (vítimas morrem em hospitais fora do município do acidente)",
    },

    "PA_VALAPR vs PA_QTDPRO": {
        "descricao":  "Campo financeiro oficial do SIA",
        "valido":     "PA_VALAPR — Valor aprovado pelo SUS (ja auditado)",
        "evitar":     "PA_QTDPRO — Quantidade которая não passou pelo crivo de aprovação",
        "referencia": "TCU 2020 — 'A variável PA_QTDAPR será utilizada por ela ter a informação já aprovada pelo SUS'",
    },

    "Custo per capita": {
        "formula":   "custo_total_SIA / populacao_ibge",
        "denominador": "População estimada IBGE (SIDRA 6579)",
        "uso":       "Comparar ônus financeiro entre municípiosnormalized por tamanho populacional",
    },

    "Taxa por 100mil hab": {
        "formula":   "(obitos / populacao) * 100000",
        "referencia": "Padrão OMS / DATASUS / SIMU",
        "nota":      "Indicador mais usado, porém sensível a variações na base de população",
    },

    "Faixas etárias padronizadas": {
        "definidas": ["0-14", "15-24", "25-34", "35-44", "45-54", "55-64", "65+"],
        "uso":       "Agregação e filtragem no pipeline Silver → Gold",
    },
}

# ── Cruzamentos já realizados / validados ────────────────────────────────────

CRUZAMENTOS = {
    "SIM + IBGE (óbitos por ocorrência + geografia)": {
        "join":  "Silver SIM.cod_mun_ocorrencia → IBGE.cod_mun_ibge_7",
        "result": "Óbitos com lat/lon, UF, região intermediária/imediata, área km²",
        "usado_em": "Dashboards de mapa, rankings municipais",
    },

    "SIM + IBGE (óbitos por residência + geografia)": {
        "join":  "Silver SIM.cod_mun_residencia → IBGE.cod_mun_ibge_7",
        "result": "Perfil demográfico da vítima por município de moradia",
        "usado_em": "Análises de vulnerabilidade, perfil etário",
    },

    "SIA + IBGE (custos + geografia)": {
        "join":  "Silver SIA.cod_mun (6d) → IBGE.cod_mun_ibge_6 (com prefixo UF)",
        "result": "Custos ambulatoriais com lat/lon, região, área",
        "usado_em": "Indicadores de custo per capita, mapas de impacto financeiro",
    },

    "SIM (óbitos) + DENATRAN (frota)": {
        "join":  "Gold óbito.cod_mun_ibge + ano → Gold frota.cod_mun_ibge + ano",
        "result": "Taxa de mortalidade por 10k veículos por município/ano",
        "usado_em": "ADR-002 — modelo dimensional; análise de sinistralidade relativa",
        "nota":    "Frota agregada por ano, não mensal — usar ano do óbito para join",
    },

    "Gold óbito + SIDRA 6579 (população)": {
        "join":  "Gold óbito.cod_mun_ibge + ano → IBGE_populacao.cod_mun_ibge + ano",
        "result": "Taxa por 100mil hab",
        "importante": "População varia por ano — usar ano correto no join",
    },

    "Gold custos + Gold óbito (side-by-side)": {
        "result": "Comparar custo ambulatorial vs mortalidade por município/uf",
        "usado_em": "Dashboard resumo, correlação custo × óbito",
    },
}

# ── Bases futuras (não ainda no código) ────────────────────────────────────────

BASES_FUTURAS = {
    "PRF — Acidentes de Trânsito (Boletim de Ocorrência)": {
        "orgao":       "Polícia Rodoviária Federal",
        "url":         "https://www.gov.br/prf/pt-br/acesso-a-informacao/dados-abertos/dados-estatisticos-de-acidentes",
        "periodicidade": "Anual / trimestral",
        "campos_relevantes": [
            ("br",       "Rodovia (BR-xxxx)"),
            ("km",       "Kilômetro"),
            ("causa_acidente", "Causa registrada no BO"),
            ("tipo_acidente",  "Colisão, saída de pista, capotamento, etc."),
            ("data",     "Data/hora"),
            ("municipio", "Código ou nome IBGE do município"),
            ("vitimas",  "Quantidade de feridos/mortos"),
            ("veiculos", "Tipos de veículos envolvidos"),
        ],
        "potencial": [
            "Dados por BR/km (geolocalização fina — hotspot em trechos específicos)",
            "Cruzamento com SIM para validar mortalidade (PRF × DATASUS)",
            "Análise de correlação causa/tipo de via",
            "Sem dados de custos — mas permite análise de severidade",
        ],
        "status_no_codigo": "NÃO implementado — futuro",
    },

    "RENAEST — Registro Nacional de Acidentes e Estatísticas de Trânsito": {
        "orgao":       "Ministério dos Transportes / DENATRAN",
        "url":         "https://dados.transportes.gov.br/",
        "descricao":   "Sistema que consolida dados de acidentes de trânsito de múltiplas fontes (PRF, DETRANs, SAMU)",
        "campos_relevantes": [
            ("tipo_acidente", "Categoria do acidente"),
            ("gravidade",     "Ileso, ferido leve, grave, morte"),
            ("data",          "Data"),
            ("uf",            "UF"),
            ("municipio",     "Código IBGE"),
            ("br",            "Rodovia (se rodoviário)"),
            ("veiculos",      "Veículos envolvidos"),
            ("pessoas",       "Vítimas por gravidade"),
        ],
        "potencial": [
            "Consolidação nacional de acidentes (não só mortes, mas feridos graves)",
            "Cruzamento com SIM para validação (mortes confirmadas vs registro PRF)",
            "Cruzamento com SIA para custos Hospitalares (SIH — internações)",
            "Análise de subnotificação: mortes PRF × mortes SIM",
        ],
        "status_no_codigo": "NÃO implementado — futuro",
        "nota": "É a fonte que unificará PRF + DETRAN + outros — futuro próximo do projeto",
    },

    "SIH — Sistema de Informações Hospitalares": {
        "orgao":       "DATASUS",
        "url":         "https://datasus.saude.gov.br/transferencia-de-arquivos/",
        "tabela":      "SIH/RD (AIH reducida)",
        "campos_relevantes": [
            ("DIAG_PRINCIPAL", "CID da internação"),
            ("MUNIC_RES",      "Código IBGE município residência"),
            ("VAL_TOT",        "Valor total da internação"),
            ("DT_INTER",       "Data de internação"),
            ("CNES",           "Código do hospital"),
        ],
        "potencial": [
            "Custo de internações por acidentes (AIH > custo ambulatorial SIA)",
            "Cruzamento com SIM para validar letalidade (internações que evoluíram para óbito)",
            "Custo médio por tipo de accidente (comparar com SIA/PA)",
        ],
        "status_no_codigo": "NÃO implementado — futuro",
        "referencia_artigo": "SciELO 2025 (Record Linkage SIM + SIVEP) usa mesma estrutura de linkage",
    },

    "DATASUS TABNET/TABWIN": {
        "url":     "https://datasus.saude.gov.br/",
        "info":    "Interface de consulta do DATASUS para SIM, SIA, SIH, SINASC",
        "uso":     "Validação de resultados contra fontes oficiais; cross-check anual",
        "urls_referencia": [
            ("SIM — Mortalidade",      "https://datasus.saude.gov.br/transferencia-de-arquivos/ (FTP SIM)"),
            ("SIA — Ambulatorial",     "https://datasus.saude.gov.br/transferencia-de-arquivos/ (FTP SIA)"),
            ("Tabnet Online",          "https://datasus.saude.gov.br/"),
        ],
    },

    "ONSV — Observatório Nacional de Segurança Viária": {
        "url":     "https://onsv.github.io/analise-datasus-2023/datasus2023.html",
        "info":    "Análise consolidada de mortes no trânsito brasileiro (dados DATASUS 2023)",
        "uso":     "Benchmark externo para validar números do pipeline",
        "metodologia": "Agregação por residência, CID V01–V89, SIM/DATASUS",
        "referencia":  "PAC_AUDITORIA_SIM_SIA.md — usa ONSV como benchmark de cross-check",
    },

    "SIMU — Sistema Indicadores de Mobilidade e Segurança": {
        "url":  "https://simu.cidades.gov.br/",
        "info": "Indicador: mortes em acidentes de trânsito por 100 mil habitantes",
        "uso": "Validação de taxa por 100mil; metodologia oficial do Ministério das Cidades",
        "nota": "Usa óbito por OCORRÊNCIA para recorte municipal (não residência)",
    },

    "Atlas Brasil — IDH Municipal": {
        "url":     "http://www.atlasbrasil.org.br/",
        "info":    "IDH por município (educação, renda, longevidade)",
        "potencial_cruzamento": [
            "IDH vs taxa de mortalidade (municípios de baixa renda têm maior sinistralidade?)",
            "Correlação renda × frota × acidentes",
        ],
        "status_no_codigo": "NÃO implementado — oportunidade de enriquecimento",
    },

    "PNATRANS — Plano Nacional de Redução de Mortes": {
        "url":  "https://www.gov.br/mobilidade/pt-br/assuntos/seguranca-no-transito/pntrans",
        "info": "Política federal com metas de redução de mortes até 2030 (ODS 3.6)",
        "uso": "Comparar evolução real vs metas do PNATRANS por UF/município",
        "referencia": "REVISAO_LITERATURA.md — Meta 3.6 ODS",
    },
}

# ── Regras de ouro descobertas ────────────────────────────────────────────────

REGRAS = [
    ("TRIM() sempre", "Todos os campos string do DATASUS podem ter espaços — aplicar TRIM() antes de qualquer transformação"),
    ("LEFT(cid,3) para grupo", "Para filtrar V01–V89 usar LEFT(TRIM(campo), 3) BETWEEN 'V01' AND 'V89' — nunca CAUSABAS completo"),
    ("PA_VALAPR > PA_QTDPRO", "Sempre usar PA_VALAPR (aprovado) para análises financeiras, conforme validação TCU 2020"),
    ("CODMUNOCOR ≠ CODMUNRES", "Não confundir ocorrência com residência — têm valores diferentes e geram indicadores distintos"),
    ("PA_MUNPCN = residência", "No SIA, o município é sempre o de residência do paciente, não o de atendimento"),
    ("Código 7d para JOIN", "CODMUNOCOR e CODMUNRES são 7 dígitos; PA_MUNPCN é 6 dígitos — normalizar antes de JOIN com IBGE"),
    ("6d para complementar", "PA_MUNPCN de 6 dígitos: concatenar com código UF (2d) para obter os 7d completos"),
    ("Descartar DTOBITO null", "Registros com data de óbito inválida/nula devem ser removidos — documentar perda"),
    ("Cross-check obrigatório", "Antes de publicar números, comparar com ONSV e SIMU (mesma metodologia CID V01–V89)"),
]

# ── Funções de output ─────────────────────────────────────────────────────────

def titulo(texto, nivel=1):
    prefixos = {1: "=", 2: "-", 3: "^", 4: "+"}
    if nivel == 1:
        return f"\n{'=' * 60}\n{texto}\n{'=' * 60}\n"
    elif nivel == 2:
        return f"\n{texto}\n{'─' * len(texto)}\n"
    elif nivel == 3:
        return f"\n## {texto}\n"
    elif nivel == 4:
        return f"\n### {texto}\n"
    return texto

def gerar_markdown():
    linhas = []

    # Header
    linhas.append(f"# Resumo de Conhecimentos e Fontes — tcc-pipeline-transito-sus")
    linhas.append(f"\n*Gerado em: {TODAY}*")
    linhas.append("\n> Este documento compila o conhecimento acumulado durante as pesquisas e ")
    linhas.append("descobertas sobre fontes de dados, conceitos metodológicos e possibilidades ")
    linhas.append("de cruzamento para enriquecimento do lakehouse e banco de consumo analítico.")
    linhas.append("\n---\n")

    # ── 1. Fontes já integradas ────────────────────────────────────────
    linhas.append(titulo("1. FONTES JÁ INTEGRADAS AO PIPELINE", 1))

    for nome, dados in FONTES_INTEGRADAS.items():
        linhas.append(titulo(nome, 3))
        linhas.append(f"**Órgão**: {dados.get('orgao', 'N/A')}")
        linhas.append(f"**URL**: {dados.get('url', 'N/A')}")
        linhas.append(f"**Protocolo**: {dados.get('protocolo', 'N/A')}")

        if "tabela" in dados:
            linhas.append(f"**Tabela/Arquivo**: `{dados['tabela']}`")
        if "filtro_cid" in dados:
            linhas.append(f"**Filtro CID-10**: `{dados['filtro_cid']}`")

        if "campos_chave" in dados:
            linhas.append(titulo("Campos importantes", 4))
            linhas.append("| Campo | Descrição |")
            linhas.append("|-------|-----------|")
            for campo, desc in dados["campos_chave"]:
                linhas.append(f"| `{campo}` | {desc} |")

        if "semantica" in dados:
            linhas.append(titulo("Semântica", 4))
            for s in dados["semantica"]:
                linhas.append(f"- {s}")

        if "idiossincrasias" in dados:
            linhas.append(titulo("Pegadinhas e dicas", 4))
            for idio in dados["idiossincrasias"]:
                linhas.append(f"- ⚠️ {idio}")

        if "uso_estrategico" in dados:
            linhas.append(titulo("Uso estratégico", 4))
            for uso in dados["uso_estrategico"]:
                linhas.append(f"- {uso}")

        if "query_referencia" in dados:
            linhas.append(titulo("Query SQL de referência", 4))
            linhas.append("```sql")
            linhas.append(dados["query_referencia"].strip())
            linhas.append("```")

    # DENATRAN
    linhas.append(titulo("DENATRAN/RENAVAM — Frota de Veículos", 3))
    fd = FONTES_INTEGRADAS["DENATRAN/RENAVAM — Frota de Veículos"]
    linhas.append(f"**URL**: {fd['url']}")
    linhas.append(f"**Campos**: {', '.join([c[0] for c in fd['campos_chave']])}")
    linhas.append("\n**Tipos de veículo conhecidos**:")
    for tv in fd["tipos_veiculo_conhecidos"]:
        linhas.append(f"- `{tv}`")
    linhas.append("\n**Uso estratégico**:")
    for uso in fd["uso_estrategico"]:
        linhas.append(f"- {uso}")
    linhas.append("\n```sql")
    linhas.append(fd["query_referencia"].strip())
    linhas.append("```")

    # SIDRA
    linhas.append(titulo("IBGE — Tabelas SIDRA", 3))
    for cod, dados in FONTES_INTEGRADAS["SIDRA — Tabelas IBGE"]["tabelas"].items():
        linhas.append(f"**Tabela {cod}** — {dados['nome']}")
        linhas.append(f"  URL: {dados['url']}")
        linhas.append(f"  Uso: {dados['uso']}")
        linhas.append(f"  Campos: {dados['campos']}\n")

    # ── 2. Conceitos-chave ──────────────────────────────────────────────
    linhas.append(titulo("2. CONCEITOS-CHAVE DESCOBERTOS", 1))

    for conceito, dados in CONCEITOS.items():
        linhas.append(titulo(conceito, 3))
        if "descricao" in dados:
            linhas.append(f"{dados['descricao']}\n")
        if "formula" in dados:
            linhas.append(f"**Fórmula**: `{dados['formula']}`")
        if "vantagem" in dados:
            linhas.append(f"**Vantagem**: {dados['vantagem']}")
        if "sql_exemplo" in dados:
            linhas.append(f"```sql\n{dados['sql_exemplo']}\n```")
        if "subgrupos_utilizados" in dados:
            linhas.append("**Subgrupos CID V01–V89**:")
            linhas.append("| Range | Categoria |")
            linhas.append("|-------|---------|")
            for rng, cat in dados["subgrupos_utilizados"]:
                linhas.append(f"| `{rng}` | {cat} |")
        if "importante" in dados:
            linhas.append(f"\n⚠️ **Importante**: {dados['importante']}")

    # Residência vs Ocorrência
    linhas.append(titulo("Residência vs Ocorrência — Conceito Fundamental", 3))
    rc = CONCEITOS["Residência vs Ocorrência"]
    linhas.append(f"{rc['descricao']}\n")
    linhas.append("| Conceito | Campo SIM | Significado |")
    linhas.append("|----------|-----------|------------|")
    for tipo in ["ocorrencia", "residencia"]:
        d = rc[tipo]
        linhas.append(f"| {tipo.capitalize()} | `{d['campo_sim']}` | {d['significado']} |")
    linhas.append(f"\n**SIA**: `{rc['sia']['campo']}` = {rc['sia']['significado']}")
    if "nota" in rc:
            linhas.append(f"\n⚠️ **Nota**: {rc['nota']}")

    # ── 3. Cruzamentos realizados ──────────────────────────────────────
    linhas.append(titulo("3. CRUZAMENTOS JÁ REALIZADOS / VALIDADOS", 1))
    linhas.append("Os seguintes cruzamentos estão implementados e testados no pipeline.\n")

    for nome, dados in CRUZAMENTOS.items():
        linhas.append(titulo(nome, 3))
        for key in ["join", "result", "usado_em", "nota"]:
            if key in dados:
                linhas.append(f"**{key.replace('_', ' ').capitalize()}**: {dados[key]}")
        linhas.append("")

    # ── 4. Bases futuras ────────────────────────────────────────────────
    linhas.append(titulo("4. BASES DE DADOS FUTURAS (NÃO IMPLEMENTADAS)", 1))
    linhas.append("Estas fontes foram identificadas durante a pesquisa e são candidatas ")
    linhas.append("a importação para o lakehouse. Algumas são prioridade do Thallys.\n")

    for nome, dados in BASES_FUTURAS.items():
        linhas.append(titulo(nome, 3))
        if "orgao" in dados:
            linhas.append(f"**Órgão**: {dados['orgao']}")
        linhas.append(f"**URL**: {dados.get('url', 'N/A')}")
        if "descricao" in dados:
            linhas.append(f"**Descrição**: {dados['descricao']}")

        if "campos_relevantes" in dados:
            linhas.append("\n**Campos relevantes**:")
            linhas.append("| Campo | Significado |")
            linhas.append("|-------|-------------|")
            for campo, desc in dados["campos_relevantes"]:
                linhas.append(f"| `{campo}` | {desc} |")

        if "potencial" in dados:
            linhas.append("\n**Potencial de cruzamento**:")
            for p in dados["potencial"]:
                linhas.append(f"- {p}")

        status = dados.get("status_no_codigo", "")
        if "NÃO implementado" in status:
            linhas.append(f"\n🚧 **Status**: {status}")
        if "referencia_artigo" in dados:
            linhas.append(f"📖 **Referência**: {dados['referencia_artigo']}")

    # ── 5. Regras de ouro ───────────────────────────────────────────────
    linhas.append(titulo("5. REGRAS DE OURO (Lições aprendidas)", 1))
    linhas.append("Estas regras foram descobertas por tentativa, erro e validação cruzada.\n")
    for i, (regra, obs) in enumerate(REGRAS, 1):
        linhas.append(f"{i}. **{regra}** — {obs}")

    # ── 6. Oportunidades de cruzamento não exploradas ───────────────────
    linhas.append(titulo("6. OPORTUNIDADES DE CRUZAMENTO NÃO EXPLORADAS", 1))

    oportunidades = [
        ("PRF × SIM (mortalidade)", "Validar número de mortes PRF vs SIM — identifica subnotificação"),
        ("RENAEST × SIM × SIH", " cross-link para medir qualidade do registro (mortes que aparecem no SIM mas não no RENAEST)"),
        ("Frota DENATRAN × PIB(IDH) × mortalidade", "Análise multivariada: municipios de alta frota + baixa renda = maior risco?"),
        ("SIH × SIA (custos)", "Combinar internações (SIH) com ambulatório (SIA) para custo total do SUS por trânsito"),
        ("Região intermediária × corredor de risco", "Agregar BRs por região intermediária — identificar eixos rodoviários de alta sinistralidade"),
        ("Evolução temporal da frota × mortalidade", "Análise de tendência: crescimento da frota de motos correlaciona com aumento de Mortality?"),
    ]

    for nome, desc in oportunidades:
        linhas.append(f"- **{nome}**: {desc}")

    # ── 7. Fontes de validação (cross-check) ────────────────────────────
    linhas.append(titulo("7. FONTES DE VALIDAÇÃO (CROSS-CHECK)", 1))
    linhas.append("Antes de publicar indicadores, comparar com estas fontes oficiais:\n")
    validacao = [
        ("ONSV — Análise DATASUS 2023", "https://onsv.github.io/analise-datasus-2023/datasus2023.html", "Benchmark de mortalidade nacional"),
        ("SIMU — Indicador por 100mil hab", "https://simu.cidades.gov.br/", "Metodologia oficial Ministério das Cidades"),
        ("Tabnet DATASUS", "https://datasus.saude.gov.br/", "Consulta direta SIM/SIA/SIH para validação pontual"),
        ("Painel ONSV", "https://onsv.github.io/", "Dashboards consolidados de segurança viária"),
    ]
    linhas.append("| Fonte | URL | Uso |")
    linhas.append("|-------|-----|-----|")
    for nome, url, uso in validacao:
        linhas.append(f"| {nome} | {url} | {uso} |")

    # Footer
    linhas.append(f"\n---\n")
    linhas.append("*Documento gerado automaticamente pelo Hermes Agent — projeto tcc-pipeline-transito-sus*")

    return "\n".join(linhas)


def gerar_json():
    """Gera um dict serializável com todo o conhecimento para importação no lake."""
    return {
        "data_geracao": TODAY,
        "projeto": "tcc-pipeline-transito-sus",
        "fontes_integradas": FONTES_INTEGRADAS,
        "conceitos_chave": CONCEITOS,
        "cruzamentos_realizados": CRUZAMENTOS,
        "bases_futuras": BASES_FUTURAS,
        "regras_de_ouro": REGRAS,
    }


if __name__ == "__main__":
    md = gerar_markdown()
    output_md = OUTPUT_DIR / f"resumo_conhecimento_{TODAY}.md"
    output_json = OUTPUT_DIR / f"resumo_conhecimento_{TODAY}.json"

    output_md.write_text(md, encoding="utf-8")
    print(f"✅ Markdown gerado: {output_md}")

    import json
    output_json.write_text(json.dumps(gerar_json(), indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"✅ JSON gerado: {output_json}")