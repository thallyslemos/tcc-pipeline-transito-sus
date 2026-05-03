# Dados de Município e UF — Semântica e Qualidade

Este documento esclarece a semântica dos campos de município nas bases SIM e SIA, identifica problemas de qualidade (ex.: Fortaleza/Joinville exibidos como BA) e orienta correções.

---

## 1. Campos de Município por Base

### 1.1 SIM (Sistema de Informações sobre Mortalidade)

| Campo DATASUS | Significado | Uso atual no pipeline |
|---------------|-------------|------------------------|
| **CODMUNOCOR** | Município de **ocorrência** do óbito (onde a pessoa morreu) | ✅ Usado → `cod_mun_ocorrencia` |
| **CODMUNRES** | Município de **residência** do falecido (onde morava) | ⚠️ Armazenado no Silver, não usado no Gold |
| **UF** (coluna raw) | Pode ser UF do arquivo ou do registro — **não confiável** | ❌ Usado → origem do bug |

**Referência**: PCDaS/Fiocruz — [Dicionário de Variáveis SIM](https://pcdas.icict.fiocruz.br/conjunto-de-dados/sistema-de-informacoes-de-mortalidade-sim/dicionario-de-variaveis/).  
Estatísticas oficiais de mortalidade no Brasil são tradicionalmente por **residência**; para acidentes de trânsito, **ocorrência** costuma ser mais relevante (local do acidente).

### 1.2 SIA/PA (Sistema de Informações Ambulatoriais — Produção Ambulatorial)

| Campo DATASUS | Significado | Uso atual no pipeline |
|---------------|-------------|------------------------|
| **PA_MUNPCN** | Município do **paciente** (residência do paciente) | ✅ Usado quando existe |
| **PA_CODMUN** | Município (layout antigo) | Fallback |
| **PA_UFMUN** | Alternativa em layouts antigos | Fallback |
| **UF** (coluna raw) | UF do arquivo de origem — **não confiável** | ❌ Usado → origem do bug |

**Nota**: O SIA não fornece município do **estabelecimento** no layout padrão do PA. Os custos são atribuídos ao município do **paciente** (residência).

---

## 2. Problema Identificado: UF Incorreta (Fortaleza/Joinville como BA)

### Sintoma

Municípios de outros estados (ex.: Fortaleza-CE, Joinville-SC) aparecem com **UF = BA** no dashboard e no mapa.

### Causa provável

O pipeline utiliza a coluna **UF** do registro bruto do SIM/SIA. Os arquivos do DATASUS são organizados **por UF do arquivo** (ex.: `DOBA2024.dbc`, `PABA202401.dbc`). A coluna UF no registro pode refletir a UF do **arquivo** (estado que enviou os dados), não a UF do **município**.

Exemplos:
- Paciente de Fortaleza (2304407) atendido em estabelecimento da BA → registro em arquivo BA → UF = "BA"
- Óbito ocorrido em Joinville (4209102) mas em arquivo de SC com UF mal preenchida ou em arquivo consolidado

### Regra correta

**UF deve ser derivada do código do município**, nunca da coluna UF bruta do registro:
- Usar JOIN com `ibge_municipios.parquet` e pegar `ibge.uf`
- Ou inferir pelos 2 primeiros dígitos do código IBGE 6 dígitos: 23=CE, 29=BA, 42=SC, etc.

---

## 3. Semântica: O Que Cada Métrica Representa

| Métrica | Base | Campo município | Interpretação |
|---------|------|-----------------|---------------|
| **Óbitos** | SIM | CODMUNOCOR | Óbitos ocorridos **no município** (local do acidente/falecimento) |
| **Custos SIA** | SIA/PA | PA_MUNPCN | Custos atribuídos ao município de **residência do paciente** |

**Implicações:**
- Óbitos por ocorrência: refletem onde o acidente/death aconteceu.
- Custos por município do paciente: refletem onde o paciente mora; o atendimento pode ter sido em outro município/estado.

Isso pode explicar cruzamentos aparentemente estranhos (ex.: paciente de Fortaleza atendido na BA, com custo atribuído a Fortaleza, mas exibido como BA por erro de UF).

---

## 4. Questionamentos e Fontes para Respostas

| Pergunta | Fonte sugerida |
|----------|----------------|
| O campo UF no SIM raw representa UF de quê (arquivo, ocorrência, residência)? | Manual do SIM (Ministério da Saúde), layout DBC DATASUS |
| O SIA/PA tem campo de município do estabelecimento? | Layout PA — Informe Técnico SIA/SUS (BRASIL, 2019) |
| É viável cruzar SIA com CNES para obter município do estabelecimento? | CNES (cadastro de estabelecimentos) + documentação do SIA |
| Qual critério oficial para estatísticas de mortalidade por trânsito: residência ou ocorrência? | PNATRANS, ONSV, metodologia DATASUS TabNet |
| Há histórico de mudança de códigos IBGE que exija tabela de equivalência? | IBGE — histórico de códigos municipais |

---

## 5. Ações Recomendadas (Ver BACKLOG_TAREFAS.md)

1. **Derivar UF do município**: no Silver ou Gold, obter UF via IBGE ou pelos 2 primeiros dígitos do `cod_mun`, nunca da coluna raw `UF`.
2. **Documentar escolha de município**: em relatórios e dashboards, deixar explícito se óbitos são por **ocorrência** e custos por **residência do paciente**.
3. **Validação de consistência**: alertar quando `cod_mun` (2 primeiros dígitos) for incoerente com `UF` do registro.
4. **Auditoria de amostra**: conferir manualmente registros de Fortaleza/Joinville nos Parquets Bronze/Silver para validar a causa.
