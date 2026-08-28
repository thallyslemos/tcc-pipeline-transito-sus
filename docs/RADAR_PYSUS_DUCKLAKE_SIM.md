# Radar PySUS 2.x, DuckLake e fontes do SIM

**Data:** 31/07/2026  
**Branch de trabalho:** `audit/silver-sim-qa`  
**Escopo:** avaliar se as novidades do PySUS ajudam a tornar a ingestão do SIM mais completa, idempotente e auditável para a análise municipal da Bahia 2010–2024. Nenhuma dependência de produção foi atualizada nesta etapa.

## Resultado executivo

O PySUS 2.7.0 merece uma POC controlada para inventário e validação, mas ainda não deve substituir o fluxo FTP atual nem ser usado como solução automática de deduplicação.

Na POC temporária:

- `pysus==2.7.0` expôs `list_files("SIM", client="ftp", state="BA", year=...)`;
- o catálogo retornou 14 dos 15 anos esperados entre 2010 e 2024;
- o ano ausente foi 2012;
- a listagem direta do FTP oficial confirmou que `DOBA2012.DBC` existe;
- portanto, a cobertura do catálogo PySUS não pode ser tratada como prova de cobertura do FTP;
- o ambiente do projeto ainda usa `pysus==1.0.1` e `duckdb==1.5.3`.

## O que o PySUS 2.7 acrescenta

Segundo a documentação oficial do projeto:

- funções simplificadas como `sim(state="BA", year=2024)`;
- `list_files` para inventário sem baixar os microdados;
- clientes separados para FTP, catálogo DuckLake e dados.gov.br;
- leitura de vários Parquet em modos `strict`, `intersection` e `union`;
- catálogo local de downloads e metadados de arquivo;
- verificação de hash disponível no modelo DuckLake quando o catálogo fornece o hash;
- opção `add_dv`, que deve ser explicitamente desligada (`add_dv=False`) na auditoria para não sobrescrever os códigos municipais brutos.

Esses recursos são úteis para descoberta, manifesto, validação de schema e linhagem. Não substituem uma política do projeto para identidade de arquivo, snapshot, hash e destino de escrita.

## O que não deve ser inferido

- O catálogo local não é uma garantia de que duas URLs diferentes tenham conteúdo distinto.
- Um estado `downloaded` não é prova suficiente de integridade do conteúdo se não houver hash ou comparação com o tamanho remoto.
- `read_parquet(mode="union")` pode esconder drift de schema; auditoria deve começar em `strict` e registrar as diferenças antes de usar `union`.
- “DuckLake” do PySUS é a camada de catálogo/arquivos usada pelo projeto PySUS; isso não obriga o pipeline a migrar para a extensão DuckDB DuckLake.
- A extensão DuckDB DuckLake e o catálogo PySUS são tecnologias relacionadas, mas não são o mesmo contrato de armazenamento.

## Fontes oficiais consultadas

### SIM/DATASUS

- FTP raiz: `ftp://ftp.datasus.gov.br/dissemin/publicos/`
- Arquivos SIM: `ftp://ftp.datasus.gov.br/dissemin/publicos/SIM/CID10/DORES/`
- Leiaute atual: `SIM/CID10/DOCS/Estrutura_do_SIM_2025.pdf`
- Leiaute histórico: `SIM/CID10/DOCS/Estrutura_SIM_Anterior.pdf`
- Pacote de tabelas: `SIM/CID10/DOCS/Docs_Tabs_CID10.zip`
- Tabelas: `SIM/CID10/TABELAS/CADMUN.DBF`, `CID10.DBF`, `TABUF.DBF`
- Dicionário oficial atual: `https://svs.aids.gov.br/download/Dicionario_de_Dados_SIM_tabela_DO.pdf`
- Manual de preenchimento da DO: `https://svs.aids.gov.br/daent/cgiae/coesv/sistemas-informacao/sim/documentacao/declaracao-obito-manual-instrucoes-preenchimento.pdf`

O leiaute oficial confirma:

- `SEXO=0/9` como ignorado, nunca feminino;
- `CODMUNRES` como município de residência habitual;
- `CODMUNOCOR` como município em que o óbito ocorreu;
- `CAUSABAS` como causa básica da Declaração de Óbito;
- `IDADE` em três posições, com unidade no primeiro dígito;
- `DTOBITO` no formato `ddmmaaaa`.

O manual também esclarece que o município de ocorrência é o local do óbito, inclusive quando a morte ocorre em via pública ou rodovia; não deve ser substituído automaticamente pelo município do hospital que emitiu a DO.

### PySUS

- Repositório oficial: `https://github.com/AlertaDengue/PySUS`
- README 2.x: `https://github.com/AlertaDengue/PySUS/blob/main/README.md`
- Documentação de fontes: `https://pysus.readthedocs.io/en/latest/tutorials/data_sources.html`
- Documentação da API: `https://pysus.readthedocs.io/en/latest/api.html`
- Changelog: `https://github.com/AlertaDengue/PySUS/blob/main/CHANGELOG.md`
- Projeto DuckLake: `https://duckdb.org/docs/stable/core_extensions/ducklake.html`

## POC segura a executar

1. Enumerar via FTP direto e via `list_files(client="ftp")` os mesmos anos, estados e grupos.
2. Salvar somente um manifesto versionado em área de staging, contendo URL, nome, ano, UF, tamanho remoto, data de modificação, hash local quando baixado e versão do PySUS.
3. Baixar uma amostra pequena para cache fora de `data/bronze`.
4. Verificar `sha256`/`verify` quando disponível.
5. Ler a amostra com `add_dv=False` e `mode="strict"`; registrar diferenças antes de qualquer `union`.
6. Comparar colunas raw, comprimentos de códigos municipais, `IDADE`, `SEXO`, `DTOBITO` e `CAUSABAS` com o Bronze atual.
7. Executar duas vezes e exigir manifesto idêntico e nenhum novo registro por repetição do mesmo `remote_path + client + hash`.
8. Só depois avaliar um adapter para o pipeline, mantendo Parquet Bronze/Silver e a pergunta científica como contrato.

## Critério de decisão

O PySUS 2.x será adotado no pipeline somente se a POC demonstrar, com testes, que melhora pelo menos um destes pontos sem reduzir rastreabilidade:

- cobertura de arquivos e anos;
- detecção de schema drift;
- verificação de integridade por hash;
- idempotência de downloads;
- reprodutibilidade de snapshots.

Até lá, o caminho seguro é manter o FTP como fonte canônica de cobertura, adicionar manifesto e hashes ao Bronze e usar o PySUS como camada de inventário e validação experimental.
