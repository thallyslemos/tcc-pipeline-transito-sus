# Guia para Agentes IA e Desenvolvedores

Este documento orienta agentes (Cursor, Copilot, Claude, etc.) e desenvolvedores a entenderem o projeto, manterem padrões e entregarem resultados consistentes.

---

## 1. Visão do Projeto

- **Objetivo**: MVP de TCC — pipeline analítico de acidentes de trânsito no SUS (DATASUS), com impacto econômico e macrotendências.
- **Stack**: Python (PySUS, DuckDB, FastAPI, FastMCP), Next.js, MapLibre, TimesFM, Ollama.
- **Arquitetura**: Medallion (Bronze → Silver → Gold), enriquecimento IBGE, API REST + MCP para chat em linguagem natural.

**Leia antes de codar**: `README.md`, `docs/ARCHITECTURE.md`, `AGENTS.md`.

---

## 2. Fluxo de Trabalho Recomendado

### Ao iniciar uma tarefa

1. Ler `docs/BACKLOG_TAREFAS.md` para entender prioridades e critérios de aceite.
2. Verificar `AGENTS.md` para comandos e caveats.
3. Consultar `docs/DADOS_MUNICIPIO.md` em tarefas de dados geográficos ou UF.
4. **Test-first**: escrever ou ajustar teste antes de implementar.

### Durante a implementação

1. Rodar `uv run ruff check .` e `uv run ruff format .`.
2. Rodar `uv run pytest tests/ -v` após alterações.
3. Evitar quebrar testes existentes; ajustar fixtures se necessário.
4. Commits atômicos: um commit por alteração lógica.

### Ao finalizar

1. Garantir que a documentação relevante esteja atualizada.
2. Marcar tarefa como concluída em `AGENTS.md` ou `docs/BACKLOG_TAREFAS.md`.

---

## 3. Padrões de Código

- **Python**: PEP 8, ruff (E, F, I, W, UP, S, B, SIM, RUF).
- **Imports**: ordem ruff (stdlib → third-party → local).
- **Tipos**: usar type hints em funções públicas.
- **Logging**: structlog, chamadas sem f-string (ex.: `logger.info("evento", chave=valor)`).
- **Config**: Pydantic Settings (`.env`), nunca valores sensíveis hardcoded.

---

## 4. Testes

- **Pipeline**: testes em `tests/test_pipeline.py`, `tests/test_silver_real_data.py`.
- **API**: testes em `tests/test_api.py`, `tests/test_iter21.py`.
- **Comando**: `uv run pytest tests/ -v`
- **Samples**: `data/test_sample/` para testes que não precisam do FTP.

---

## 5. Dados

- **Bronze**: dados brutos SIM/SIA em Parquet.
- **Silver**: filtro CID V01–V89, tipagem, campos derivados.
- **Gold**: agregados por município/competência, enriquecidos com IBGE.
- **Município**: SIM usa CODMUNOCOR (ocorrência); SIA usa PA_MUNPCN (residência do paciente). UF deve ser derivada do código IBGE, não da coluna raw — ver `docs/DADOS_MUNICIPIO.md`.

---

## 6. Comandos Essenciais

| Ação | Comando |
|------|---------|
| Instalar deps Python | `uv sync` |
| Pipeline sample | `uv run python -m data-pipeline.run` |
| Pipeline real | `uv run python -m data-pipeline.run --real --ufs BA SP --anos 2024` |
| Apenas malhas GeoJSON | `uv run python -m data-pipeline.run --malhas` |
| Backend | `uv run uvicorn backend.app:app --reload --port 8000` |
| Frontend | `cd frontend && npm run dev` |
| Testes | `uv run pytest tests/ -v` |
| Lint | `uv run ruff check .` |
| Formatar | `uv run ruff format .` |

---

## 7. Checklist para Novas Features

- [ ] Teste unitário ou de integração criado/atualizado.
- [ ] `uv run pytest tests/ -v` passa.
- [ ] `uv run ruff check .` passa.
- [ ] Documentação atualizada (README, ARCHITECTURE, BACKLOG ou doc específico).
- [ ] Sem quebra de APIs públicas (breaking changes documentadas).

---

## 8. Onde Encontrar o Quê

| Necessidade | Documento |
|-------------|-----------|
| Setup local | `docs/SETUP.md` |
| Arquitetura e fluxo | `docs/ARCHITECTURE.md` |
| Cálculos financeiros | `docs/FINANCEIRO.md` |
| Município e UF | `docs/DADOS_MUNICIPIO.md` |
| Tarefas prioritárias | `docs/BACKLOG_TAREFAS.md` |
| Comandos e caveats | `AGENTS.md` |
| Plano de iterações | `docs/PLANEJAMENTO.md` |
| Pré-projeto TCC | `docs/Thallys [TCC I] Súmula...docx.md` |
