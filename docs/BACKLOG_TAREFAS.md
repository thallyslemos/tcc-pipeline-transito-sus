# Backlog de Tarefas — Iteração 3

Esta seção detalha as próximas tarefas do projeto, com foco em auditoria, implementação da metodologia TDD, e evolução das funcionalidades do sistema.

**Metodologia**: A partir desta iteração, todas as tarefas seguirão o fluxo **Test-Driven Development (TDD)**, conforme descrito no `docs/GUIA_AGENTES.md`.

---

## Iteração 3.1 — Auditoria e Correção do Pipeline SIA

**Contexto**: O pipeline do SIM apresentou uma falha crítica de perda de dados devido ao processamento parcial de arquivos. É imperativo verificar se o pipeline do SIA (custos) sofre do mesmo problema.
**Objetivo**: Garantir a completude e a corretude dos dados de custos ambulatoriais.

### Tarefa 3.1.1: Auditoria de Dados do SIA

-   **Critérios de Aceite**:
    1.  Executar uma análise nos dados brutos do SIA (`~/pysus/PA*.parquet`) para o escopo de BA/2022.
    2.  Contar o número total de registros que correspondem ao filtro de acidentes de trânsito (`PA_CIDPRI` entre 'V01' e 'V89').
    3.  Contar o número de registros no arquivo `data/silver/sia.parquet` gerado pelo pipeline.
    4.  Comparar as duas contagens e documentar qualquer discrepância.

### Tarefa 3.1.2: Correção do Pipeline SIA (Se necessário)

-   **Critérios de Aceite**:
    1.  Se for identificada perda de dados, aplicar a mesma correção que foi feita no `data-pipeline/datasus.py` (função `baixar_sia_streaming`) para garantir que todos os arquivos de dados brutos sejam processados.
    2.  Limpar os diretórios `bronze` e `gold` e reexecutar o pipeline para BA/2022.
    3.  Validar se a contagem na camada Silver do SIA agora corresponde à contagem dos dados brutos.

---

## Iteração 3.2 — Base de Testes (TDD Foundation)

**Contexto**: Para suportar o desenvolvimento TDD e garantir a estabilidade, a base de código existente precisa de uma cobertura de testes mais robusta.
**Objetivo**: Escrever testes para as funcionalidades existentes antes de criar novas.

### Tarefa 3.2.1: Aumentar Cobertura de Testes da API

-   **Critérios de Aceite**:
    1.  Analisar os endpoints da API em `backend/routers/`.
    2.  Adicionar testes de unidade em `tests/test_api.py` para os endpoints que não possuem cobertura ou cuja cobertura é insuficiente (ex: testar diferentes parâmetros de query, casos de borda, etc.).
    3.  Resolver as falhas de teste pré-existentes relacionadas a contagens de municípios hardcoded. Substituir `== 9` por asserções dinâmicas baseadas nos dados de teste.
    4.  Garantir que `uv run pytest tests/ -v` passe em 100% dos testes.

---

## Iteração 3.3 — Backend e Frontend: Dimensões de Análise

**Contexto**: O pipeline agora produz dados de óbitos por ocorrência e residência. A API e a UI precisam ser adaptadas para consumir e apresentar essa nova estrutura de dados.
**Objetivo**: Permitir que o usuário final analise os dados de óbitos por diferentes dimensões geográficas.

### Tarefa 3.3.1: Refatorar API de Dashboard

-   **Use Case**: Um gestor de saúde quer comparar o número de óbitos ocorridos em sua cidade com o número de residentes de sua cidade que morreram (independentemente do local).
-   **Critérios de Aceite (Test-First)**:
    1.  **Escrever Teste (RED)**: Criar um novo teste em `tests/test_api.py` para um endpoint (ex: `/api/dashboard/summary`) que aceite um parâmetro de query `dimensao=residencia`. O teste deve falhar.
    2.  **Implementar (GREEN)**: Modificar o endpoint no backend para:
        -   Aceitar um parâmetro `dimensao` ('ocorrencia' ou 'residencia'), com 'ocorrencia' sendo o padrão.
        -   Carregar dados de `obitos_ocorrencia_municipio_mes.parquet` ou `obitos_residencia_municipio_mes.parquet` com base no parâmetro.
        -   Fazer o teste passar.
    3.  **Refatorar (REFACTOR)**: Limpar o código do endpoint, garantindo que os testes continuem passando.

### Tarefa 3.3.2: Adaptar Frontend

-   **Critérios de Aceite**:
    1.  Adicionar um controle na UI (ex: um `SegmentedControl` ou `Select`) no `FilterBar.tsx` que permita ao usuário escolher a dimensão de análise: "Local da Ocorrência" vs. "Local de Residência".
    2.  O estado dessa seleção deve ser gerenciado (ex: via `useState` ou Zustand).
    3.  As chamadas à API (`/api/dashboard/*`) devem incluir o novo parâmetro `dimensao`.
    4.  Os gráficos e KPIs devem se atualizar dinamicamente com base na dimensão selecionada.

---

## Iteração 3.4 — Filtros Avançados: Estado e Região

**Contexto**: A análise atualmente é muito focada em municípios. Para uma visão macro, é essencial permitir filtros por UF (Estado) e Região.
**Objetivo**: Implementar uma filtragem geográfica mais abrangente.

### Tarefa 3.4.1: Implementar Filtro por UF e Região na API

-   **Use Case**: Um analista do Ministério da Saúde quer ver o total de custos de acidentes para todos os estados da região "Nordeste".
-   **Critérios de Aceite (Test-First)**:
    1.  **Escrever Teste (RED)**: Adicionar testes à API que passem `uf=BA` ou `regiao=Nordeste` como query params e validem que os dados retornados são apenas daquela localidade.
    2.  **Implementar (GREEN)**:
        -   No backend, criar um mapeamento de Regiões para UFs (ex: `REGIOES = {"Nordeste": ["BA", "SE", "AL", ...]}`).
        -   Modificar os endpoints para filtrar os dataframes DuckDB com base nos parâmetros `uf` e/ou `regiao` antes de agregar os resultados.
        -   Fazer os testes passarem.
    3.  **Refatorar (REFACTOR)**: Otimizar a lógica de filtragem.

### Tarefa 3.4.2: Adicionar Filtros na UI

-   **Critérios de Aceite**:
    1.  Adicionar componentes `Select` na `FilterBar.tsx` para Estado (UF) and Região.
    2.  O `Select` de UF deve ser populado com a lista de estados disponíveis nos dados.
    3.  O `Select` de Região deve conter as 5 grandes regiões do Brasil.
    4.  A seleção de um filtro deve atualizar os dados exibidos nos dashboards.

---

## Iteração 3.5 — Melhorias de Performance (Backlog)

**Contexto**: O processo de busca de dados do IBGE (`ibge_fetcher.py`) é lento devido a múltiplas chamadas de API sequenciais.
**Objetivo**: Acelerar o tempo de execução do pipeline.

### Tarefa 3.5.1: Otimizar Requisições ao IBGE

-   **Critérios de Aceite**:
    1.  Refatorar as funções em `ibge_fetcher.py` que fazem loops para buscar dados da API do IBGE.
    2.  Utilizar técnicas de concorrência, como `asyncio` com `aiohttp` ou `httpx`, ou paralelismo com `concurrent.futures`, para executar as chamadas de rede em paralelo.
    3.  Implementar tratamento de erro robusto (ex: retries com exponential backoff) para lidar com a instabilidade da API.
    4.  Validar que a performance melhorou e que todos os dados continuam sendo baixados corretamente.
