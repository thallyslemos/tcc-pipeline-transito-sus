# Guia para Agentes IA e Desenvolvedores

Este documento é o guia central para o desenvolvimento do projeto. Ele orienta agentes de IA e desenvolvedores sobre a arquitetura, metodologia, padrões e fluxo de trabalho, garantindo a entrega de um produto de alta qualidade.

---

## 1. Visão e Objetivos do Projeto

- **Objetivo Principal**: Construir um sistema de apoio à decisão para analisar o impacto de acidentes de trânsito nos dados públicos do SUS, combinando engenharia de dados robusta, IA preditiva e uma interface de usuário clara e funcional.
- **Pilar de Qualidade**: O projeto preza pelo rigor metodológico e pela qualidade dos dados. Nenhuma funcionalidade é considerada "pronta" sem a devida validação e testes que garantam a consistência dos resultados.
- **Arquitetura**: Medallion (Bronze → Silver → Gold) com DuckDB e Parquet. Consulte **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** para o diagrama e detalhes.

---

## 2. Metodologia de Desenvolvimento: Test-Driven Development (TDD)

A partir de agora, o projeto adota uma metodologia **Test-First**. O ciclo de desenvolvimento para qualquer nova funcionalidade ou correção é:

1.  **CICLO VERMELHO-VERDE-REATORA (RED-GREEN-REFACTOR)**
    1.  **(RED)** Escrever um novo teste que falha: Antes de escrever qualquer código de implementação, crie um teste unitário ou de integração que valide o comportamento desejado. Execute os testes e confirme que o novo teste falha (e que nenhum outro teste quebrou).
    2.  **(GREEN)** Escrever o código mínimo necessário: Implemente a funcionalidade da forma mais simples possível, apenas o suficiente para fazer o novo teste passar. Execute todos os testes novamente e confirme que estão todos passando.
    3.  **(REFACTOR)** Refatorar e limpar o código: Com a segurança dos testes, melhore a estrutura, a clareza e o desempenho do código que você acabou de escrever, garantindo que os testes continuem passando.

2.  **Qualidade do Código**:
    - Após cada ciclo, rode os comandos de qualidade: `uv run ruff check .` e `uv run ruff format .`.
    - O código só pode ser considerado pronto se passar em todos os testes e em todas as verificações de lint.

3.  **Commit**: Faça commits atômicos e claros, referenciando a tarefa do backlog quando aplicável (ex: "feat(api): implementa filtro por regiao (closes #TASK-ID)").

---

## 3. Fluxo de Trabalho (Workflow)

### Ao iniciar uma nova tarefa:

1.  **Consultar o Backlog**: Abra o **[docs/BACKLOG_TAREFAS.md](docs/BACKLOG_TAREFAS.md)** e identifique a próxima tarefa prioritária. Entenda os critérios de aceite.
2.  **Entender o Contexto**: Leia a documentação técnica relacionada à tarefa (ex: `ARCHITECTURE.md` para mudanças no banco de dados, `DADOS_MUNICIPIO.md` para questões geográficas).
3.  **Iniciar o Ciclo TDD**: Crie um novo arquivo de teste ou adicione um novo teste a um arquivo existente que descreva a funcionalidade a ser implementada.

### Lições Aprendidas (Estudo de Caso): O Bug da Perda de Dados

Na Iteração 2, uma auditoria revelou uma perda de ~68% dos dados de óbitos. A causa raiz foi um bug no script `data-pipeline/datasus.py` que lia apenas o primeiro de múltiplos arquivos de dados brutos.

- **Lição 1: Validação de Contagem é Crucial**: Sempre valide as contagens de registros entre as camadas (Bronze vs. Silver vs. Gold) para detectar anomalias.
- **Lição 2: Idempotência do Pipeline**: O pipeline não limpava diretórios intermediários (`data/bronze/sim_parts`), misturando dados de diferentes execuções. **Ação Corretiva**: Antes de cada execução do pipeline, os diretórios de `bronze` e `gold` devem ser limpos para garantir uma execução limpa e idempotente.
- **Onde Aprender Mais**: O `PAC_AUDITORIA_SIM_SIA.md` documenta a investigação passo a passo.

---

## 4. Comandos Essenciais do Projeto

| Ação | Comando |
|------|---------|
| Instalar Dependências (Python) | `uv sync` |
| Instalar Dependências (Frontend) | `cd frontend && npm install` |
| **Executar TODOS os Testes** | `uv run pytest tests/ -v` |
| **Verificar Qualidade do Código** | `uv run ruff check .` |
| **Formatar Código** | `uv run ruff format .` |
| Iniciar Backend (API) | `uv run uvicorn backend.app:app --reload --port 8000` |
| Iniciar Frontend (UI) | `cd frontend && npm run dev` |
| Limpar Camadas de Dados | `rm -f data/bronze/**/* data/gold/*` |
| Executar Pipeline (Amostra) | `uv run python -m data-pipeline.run` |
| Executar Pipeline (Real) | `npm run pipeline:real -- --ufs BA --anos 2022` (exemplo) |

*Nota: Foi adicionado um script `npm run pipeline:real` para facilitar a passagem de argumentos para o pipeline Python.*

---

## 5. Padrões de Código e Dados

- **Dados**: A distinção entre **ocorrência** e **residência** é fundamental. A camada Gold agora reflete isso com tabelas separadas. Por padrão, as análises devem focar na **ocorrência**, mas a opção de analisar por **residência** deve ser oferecida ao usuário.
- **Python**: PEP 8, type hints, logging estruturado com `structlog`.
- **Infraestrutura**: A configuração do ambiente e das variáveis está no `docs/SETUP.md`.

---

## 6. Onde Encontrar o Quê (Guia de Documentos)

| Necessidade | Documento de Referência |
|---|---|
| **O que fazer a seguir?** | **[docs/BACKLOG_TAREFAS.md](docs/BACKLOG_TAREFAS.md)** |
| Como rodar o projeto? | `docs/SETUP.md` |
| Como a arquitetura funciona? | `docs/ARCHITECTURE.md` |
| Qual a metodologia de desenvolvimento? | `docs/GUIA_AGENTES.md` (este documento) |
| Detalhes sobre os campos de município? | `docs/DADOS_MUNICIPIO.md` |
| Detalhes sobre os cálculos? | `docs/FINANCEIRO.md` |
| Histórico de decisões? | `docs/PAC_AUDITORIA_SIM_SIA.md` |
