

---

## Iteração 5 — Granularidade de Filtros no Frontend

**Contexto**: A análise de Spec vs Impl revelou que o backend já suporta filtros por `uf`, `regiao` e `dimensao` na maioria dos endpoints, mas o frontend (especialmente a página de Mapa) não expõe essas capacidades ao usuário. Além disso, o endpoint `detalhe_municipio` e o ranking de indicadores não possuem todos os filtros especificados na arquitetura.

### Tarefa 5.1: Mapa com Filtros Completos

- **Use Case**: Analista quer visualizar o mapa de calor filtrado por região/UF e alternar entre visão de ocorrência e residência.
- **Critérios de Aceite (Test-First)**:
    1.  Adicionar filtros `uf`, `regiao` e `dimensao` ao endpoint `GET /api/dashboard/mapa`
    2.  Atualizar `fetchMapa` em `frontend/src/lib/api.ts` para aceitar `uf`, `regiao`, `dimensao`
    3.  Atualizar `mapa/page.tsx` com `FilterBar` completa (mesmos filtros do Dashboard)
    4.  Garantir que a tabela de ranking no mapa também respeite os filtros geográficos
    5.  Atualizar testes em `tests/test_api.py` para cobrir novos filtros no `/mapa`
- **(Status: Pendente)**

### Tarefa 5.2: Endpoint Detalhe de Município com Suporte a Dimensão

- **Use Case**: Usuário seleciona um município na visão por residência e deseja ver os detalhes correspondentes.
- **Critérios de Aceite (Test-First)**:
    1.  Adicionar parâmetro `dimensao: Dimensao` ao endpoint `GET /api/dashboard/municipio/{cod_mun}`
    2.  O endpoint deve selecionar dinamicamente `v_obitos_ocorrencia` ou `v_obitos_residencia` com base no parâmetro
    3.  Atualizar o frontend `municipio/page.tsx` para passar o filtro `dimensao` ativo
    4.  Documentar o novo comportamento em `docs/ARCHITECTURE.md`
    5.  Adicionar teste em `tests/test_api.py`
- **(Status: Pendente)**

### Tarefa 5.3: Ranking de Indicadores com Filtros Geográficos

- **Use Case**: Analista quer comparar ranking de municípios apenas de uma região específica (ex: só Nordeste).
- **Critérios de Aceite (Test-First)**:
    1.  Adicionar parâmetros `uf: str | None` e `regiao: Regiao | None` ao endpoint `GET /api/indicadores/ranking`
    2.  Filtrar resultados com base nos parâmetros antes de ordenar
    3.  Garantir consistência com a lógica de filtros em `routers/utils.py`
    4.  Adicionar testes em `tests/test_api.py`
- **(Status: Pendente)**

### Tarefa 5.4: Página de Ranking de Indicadores no Frontend

- **Use Case**: Usuário quer navegar em um ranking comparativo de municípios filtrado por ano, métrica e região.
- **Critérios de Aceite**:
    1.  Criar nova página `frontend/src/app/ranking/page.tsx`
    2.  Implementar filtros por ano, métrica (`taxa_obitos_100mil`, `custo_per_capita`), uf, regiao
    3.  Exibir tabela ordenada com colunas: município, UF, população, mortalidade, taxa, custo total, custo per capita
    4.  Permitir ordenação por clique no header da coluna
    5.  Adicionar paginação (limite de 50 por página)
- **(Status: Pendente)**

### Tarefa 5.5: Validação e Testes End-to-End

- **Use Case**: Garantir que todas as combinações de filtros funcionam corretamente.
- **Critérios de Aceite**:
    1.  Executar suite completa de testes: `uv run pytest tests/ -v`
    2.  Validar visualmente cada página com diferentes combinações de filtros
    3.  Verificar que não há erros de CORS ou serialização JSON
    4.  Confirmar que dados no frontend batem com queries diretas no DuckDB
- **(Status: Pendente)**

---

## Iteração 4 — Qualidade de Dados e Análise Preditiva

**Contexto**: Com a base do pipeline e dos testes estabilizada, esta iteração foca em aprofundar a qualidade da análise, melhorar a interação com o agente de IA e preparar o terreno para análises preditivas mais sofisticadas.

### Tarefa 4.1: Validação de Escopo CID-10

-   **Use Case**: Um epidemiologista questiona se o filtro `V01-V89` captura todos os acidentes de transporte relevantes ou se é muito restritivo.
-   **Critérios de Aceite**:
    1.  Verificar a documentação oficial do DATASUS sobre a classificação de "Acidentes de transporte".
    2.  Analisar a distribuição de CIDs no intervalo `V90-V99` nos dados brutos para quantificar o impacto de uma possível expansão do filtro.
    3.  Documentar a decisão em `docs/ARCHITECTURE.md`, justificando a manutenção ou alteração do escopo do filtro.
    4.  **(Status: Concluído)** A análise via `web_fetch` confirmou que `V01-V89` corresponde corretamente a "Acidentes de transporte **terrestre**", que é o escopo do projeto. Nenhuma alteração de código é necessária.

### Tarefa 4.2: Refatoração e Melhoria do Servidor MCP

-   **Use Case**: Um usuário do chat pergunta: "Pelo que posso filtrar?" e o LLM deve ser capaz de responder com uma lista de filtros válidos.
-   **Critérios de Aceite**:
    1.  Refatorar o `mcp-server/server.py` para usar a mesma lógica de conexão singleton do `backend/database.py`.
    2.  Adicionar um parâmetro `dimensao: str` às `tools` de consulta (`query_obitos`, `query_custos`) para permitir que o LLM especifique a análise por ocorrência ou residência.
    3.  Criar uma nova `tool` chamada `listar_opcoes_filtro()` que consulta os dados e retorna os valores distintos para `ano`, `tipo_veiculo`, `uf` e as regiões disponíveis.
    4.  Atualizar o `prompt` de instruções do MCP para informar ao LLM sobre a existência dessa nova `tool` e incentivá-lo a usá-la.
-   **(Status: Concluído)** Refatorado para usar `backend.database.get_connection()`, adicionado `dimensao` e a nova tool de filtros.

### Tarefa 4.3: Preparação para Análise Preditiva de Alta Resolução

-   **Use Case**: Um cientista de dados quer treinar um modelo de previsão de acidentes com base em dados diários para capturar efeitos de feriados e fins de semana.
-   **Critérios de Aceite**:
    1.  Projetar uma nova tabela na camada Gold, `eventos_diarios_municipio.parquet`, com as colunas: `data`, `cod_mun_ibge`, `total_obitos`, `custo_total`.
    2.  Criar um novo script no pipeline (`data-pipeline/gold_timeseries.py`, por exemplo) que gera essa tabela a partir da camada **Silver**, que possui granularidade diária.
    3.  A agregação deve unir os dados de óbitos (SIM) e custos (SIA) por dia e município.
    4.  Adicionar a execução deste novo script ao orquestrador `run.py`.
-   **(Status: Concluído)** Novo script `gold_timeseries.py` implementado e integrado ao pipeline principal.

### Tarefa 4.4: Adicionar Filtro por Região na API (Conclusão)

-   **Contexto**: A Iteração 3 implementou a lógica de filtro, mas é preciso garantir que ela se aplique a todos os endpoints relevantes.
-   **Critérios de Aceite (Test-First)**:
    1.  Revisar os endpoints `listar_municipios` e `dados_mapa`.
    2.  Escrever testes que falhem ao tentar filtrar esses endpoints por `uf` e `regiao`.
    3.  Implementar a lógica de filtro nesses endpoints, utilizando as funções auxiliares já criadas em `routers/utils.py`.
    4.  Garantir que todos os testes passem.
-   **(Status: Concluído)** Filtros implementados em `dashboard.py` e `geo.py`, com cobertura de testes em `tests/test_api.py`.

### Tarefa 4.5: Implementação de Testes de Frontend

-   **Use Case**: Garantir que alterações no frontend não quebrem funcionalidades críticas da interface.
-   **Critérios de Aceite**:
    1.  Instalar e configurar Vitest + React Testing Library no projeto frontend.
    2.  Criar infraestrutura de mocks para Next.js navigation e hooks de tema.
    3.  Implementar testes para componentes críticos (ex: Sidebar).
-   **(Status: Concluído)** Vitest configurado e testes básicos implementados para o componente Sidebar.
