# Backlog de Tarefas — Próximas Iterações

Tarefas priorizadas para agentes ou desenvolvedores. Cada item inclui contexto, critérios de aceite e referências.

---

## Iteração 2.7 — Correção de UF e Município (Alta prioridade)

### Tarefa 2.7.1: Derivar UF do código do município

**Contexto**: Mesmo tendo rodado o pipeline filtrando os registros da Bahia, Fortaleza (CE) e Joinville (SC) aparecem como BA porque o pipeline usa a coluna `UF` bruta do registro, que reflete a UF do **arquivo** (ex.: arquivo BA), não a UF do município. Ver `docs/DADOS_MUNICIPIO.md`. Verificar se o munifipio que estamos usando é de residencia do paciente ou do atendimento.

**Objetivo**: A UF exibida deve ser sempre a do município, obtida via código IBGE.

**Critérios de aceite**:
1. Silver ou Gold passa a obter UF via JOIN com `ibge_municipios.parquet` (`LEFT(cod_mun_ibge, 6) = LEFT(ibge.cod_mun_ibge, 6)`).
2. Fallback: se não houver IBGE, derivar UF dos 2 primeiros dígitos do código (23=CE, 29=BA, 42=SC, etc.).
3. Não usar mais a coluna `UF` bruta do SIM/SIA para exibição ou agregação.
4. Teste: registros com `cod_mun_ibge` 2304407 (Fortaleza) exibem UF=CE; 4209102 (Joinville) exibe UF=SC.

**Arquivos a alterar**: `data-pipeline/silver.py`, `data-pipeline/gold.py`, possivelmente `backend/routers/geo.py`.

**Referência**: `docs/DADOS_MUNICIPIO.md` seção 2 e 5.

---

### Tarefa 2.7.2: Validação de consistência UF × código município

**Contexto**: Detectar registros com `UF` bruta divergente do código do município para auditoria.

**Objetivo**: Registrar warning ou métrica quando houver inconsistência.

**Critérios de aceite**:
1. Script ou etapa do pipeline conta quantos registros têm `UF` bruta ≠ UF derivada do `cod_mun`.
2. Log ou relatório de qualidade com essa contagem.
3. Opcional: flag no Gold para indicar registro com inconsistência histórica.

---

## Iteração 2.8 — GeoJSON de Malhas em Qualidade Alta (Média prioridade)

### Tarefa 2.8.1: Usar qualidade alta nas malhas IBGE

**Contexto**: O pipeline baixa malhas com `qualidade=minima` (~3.7MB). O usuário reportou falhas no mapa (municípios faltando ou geometria incorreta). A API IBGE v4 suporta `qualidade=minima`, `qualidade=intermediaria` e `qualidade=maxima`.

**Objetivo**: Melhorar a qualidade visual e completude das geometrias no mapa.

**Critérios de aceite**:
1. Alterar `data-pipeline/ibge_fetcher.py`: URL de malhas usar `qualidade=intermediaria` ou `qualidade=maxima`.
2. Documentar tamanho esperado do arquivo (qualidade alta pode ser 10–50MB).
3. Atualizar `.gitignore` se o GeoJSON ficar grande demais para versionar.
4. Validar no mapa: polígonos sem "buracos" óbvios, municípios costeiros/fronteiriços com geometria coerente.
5. Teste de regressão: endpoint `/api/geo/municipios` continua retornando FeatureCollection válido.

**Arquivo**: `data-pipeline/ibge_fetcher.py` — constante `MALHAS_BR_URL`.

**Documentação IBGE**: https://servicodados.ibge.gov.br/api/docs/malhas?versao=4

---

### Tarefa 2.8.2: Mapear municípios sem geometria no mapa

**Contexto**: Alguns municípios podem não ter feature correspondente no GeoJSON (nome/UF mudou, código antigo, etc.).

**Objetivo**: Garantir que todos os municípios do Gold com métricas apareçam no mapa.

**Critérios de aceite**:
1. Backend: ao enriquecer malhas com métricas, detectar `cod6` do Gold que não existe no GeoJSON.
2. Fallback: para municípios sem polígono, incluir ponto (centroide) com as mesmas propriedades.
3. Log de municípios sem geometria (para análise).
4. Documentar lista de municípios sem malha conhecida (ex.: alterações de território).

---

## Iteração 2.9 — Melhorias de Qualidade e Testes

### Tarefa 2.9.1: Corrigir testes com assertions hardcoded

**Contexto**: 4 testes em `test_api.py` falham porque esperam exatamente 9 municípios; os dados sample geram 586.

**Objetivo**: Testes passem de forma estável.

**Critérios de aceite**:
1. Substituir `== 9` por asserções flexíveis (ex.: `>= 1`, ou valor derivado do fixture).
2. Usar dados de teste fixos (fixtures) quando o teste depender de contagem exata.
3. `uv run pytest tests/ -v` passa em todos os testes.

---

### Tarefa 2.9.2: Corrigir lint em backend/ibge.py

**Contexto**: `AGENTS.md` menciona "erro pré-existente" em `backend/ibge.py`.

**Objetivo**: `uv run ruff check .` passar sem erros nesse arquivo.

**Critérios de aceite**:
1. Resolver o erro de lint indicado.
2. Sem alterar comportamento funcional.

---

## Iteração 2.10 — Dockerização (já planejada)

Conforme `AGENTS.md` Iteração 2.6:
- Dockerfile para backend e frontend
- docker-compose.yml
- Documentar em `docs/SETUP.md`

---

## Iteração 2.11 — Chat e Documentação

### Tarefa 2.11.1: Chat com markdown e tabelas (Iteração 2.4)

Conforme `AGENTS.md`:
- `react-markdown` para respostas
- Melhorar system prompt do Ollama
- Converter resultados tabulares em markdown antes de enviar ao modelo

---

## Resumo de Prioridades

| Prioridade | Tarefa | Impacto |
|------------|--------|---------|
| Alta | 2.7.1 Derivar UF do município | Corrige dados incorretos (Fortaleza/Joinville como BA) |
| Alta | 2.7.2 Validação UF × código | Qualidade e auditoria |
| Média | 2.8.1 GeoJSON qualidade alta | Melhora visual do mapa |
| Média | 2.8.2 Municípios sem geometria | Completude do mapa |
| Média | 2.9.1 Corrigir testes | Estabilidade do CI |
| Baixa | 2.9.2 Lint backend/ibge | Consistência de código |
| Planejada | 2.6 Dockerização | Deploy simplificado |
| Planejada | 2.4 Chat markdown | UX do chat |
