

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

### Tarefa 4.3: Preparação para Análise Preditiva de Alta Resolução

-   **Use Case**: Um cientista de dados quer treinar um modelo de previsão de acidentes com base em dados diários para capturar efeitos de feriados e fins de semana.
-   **Critérios de Aceite**:
    1.  Projetar uma nova tabela na camada Gold, `eventos_diarios_municipio.parquet`, com as colunas: `data`, `cod_mun_ibge`, `total_obitos`, `custo_total`.
    2.  Criar um novo script no pipeline (`data-pipeline/gold_timeseries.py`, por exemplo) que gera essa tabela a partir da camada **Silver**, que possui granularidade diária.
    3.  A agregação deve unir os dados de óbitos (SIM) e custos (SIA) por dia e município.
    4.  Adicionar a execução deste novo script ao orquestrador `run.py`.

### Tarefa 4.4: Adicionar Filtro por Região na API (Conclusão)

-   **Contexto**: A Iteração 3 implementou a lógica de filtro, mas é preciso garantir que ela se aplique a todos os endpoints relevantes.
-   **Critérios de Aceite (Test-First)**:
    1.  Revisar os endpoints `listar_municipios` e `dados_mapa`.
    2.  Escrever testes que falhem ao tentar filtrar esses endpoints por `uf` e `regiao`.
    3.  Implementar a lógica de filtro nesses endpoints, utilizando as funções auxiliares já criadas em `routers/utils.py`.
    4.  Garantir que todos os testes passem.
