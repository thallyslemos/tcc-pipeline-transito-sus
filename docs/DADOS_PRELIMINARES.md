# Dados preliminares do SIM

Este documento descreve a camada complementar de dados **preliminares** do SIM
(Sistema de Informacoes sobre Mortalidade), paralela e isolada da camada
consolidada descrita em [`CONTRATO_SIM_EVIDENCIA_V1.md`](CONTRATO_SIM_EVIDENCIA_V1.md).

## Por que essa camada existe

O DATASUS publica o SIM em duas arvores FTP distintas:

- `/dissemin/publicos/SIM/CID10/DORES` — dados **consolidados**, fechados por
  ano-calendario. Atualmente cobre ate 2024.
- `/dissemin/publicos/SIM/PRELIM/DORES` — dados **preliminares**, do ano
  corrente e do anterior (2025/2026 no momento em que esta camada foi
  construida), ainda em captacao.

`DORES` (obitos gerais, todas as causas) e `DOFET` (obitos fetais) existem nas
duas arvores. Este projeto so ingere `DORES` — `DOFET` esta fora de escopo
porque obitos fetais nunca sao vitimas de acidente de transito (o filtro
cientifico do projeto exige `tipobito_raw = '2'`, nao-fetal; ver
[Filtro cientifico](#filtro-cientifico-idêntico-ao-consolidado) abaixo).

## Principio nao-negociavel

**Dado preliminar nunca entra na mesma agregacao que dado consolidado.** Nunca
ha `UNION` entre as duas camadas, e nenhuma serie consolidada muda de valor
por causa da ingestao preliminar.

O motivo nao e apenas "o dado preliminar ainda nao foi revisado" — e que ele e
estruturalmente **incompleto**: a base de um ano preliminar cresce por meses
apos o fim do ano-calendario, a medida que cartorios e servicos de saude
notificam obitos com atraso. Comparar o total preliminar de 2025 com o total
consolidado de 2024 mediria principalmente *quanto da captacao ja chegou*, nao
*quantos obitos aconteceram* — uma queda aparente seria, na maioria dos casos,
um artefato de captacao incompleta, nao uma reducao real de mortalidade.

Por isso:

- os artefatos preliminares vivem em caminhos paralelos (`data/bronze/prelim/`,
  `data/silver/sim_prelim_nacional.parquet`,
  `data/gold/sim_prelim_municipio_mes_*.parquet`) e nunca sobrescrevem nem sao
  lidos pelos pipelines consolidados (`data-pipeline/silver_v2.py`,
  `data-pipeline/sim_evidence.py`, `data-pipeline/datasus.py`, `data-pipeline/gold.py`,
  `data-pipeline/gold_timeseries.py`);
- a API expoe os dados preliminares em endpoints proprios,
  `GET /api/sim/prelim/*`, nunca como parametro de `/api/sim/*`;
- a interface bloqueia comparacao direta entre um ano preliminar e um ano
  consolidado na tela "Dados preliminares";
- o indicador de completude (abaixo) e um **sinal de maturidade**, nunca um
  fator de correcao — jamais multiplique a contagem preliminar por
  `1 / completude_estimada` para "estimar o total real".

## Arquitetura da camada (Bronze -> Silver -> Gold)

### Bronze: `data-pipeline/sim_prelim_ingest.py`

Coletor que reaproveita o PySUS ja usado pela ingestao consolidada, sem
fork/patch. A versao instalada (PySUS 1.0.1, `pysus.ftp.databases.sim.SIM`)
mapeia `paths` fixos para `CID10/DORES`/`CID9/DORES` — `PRELIM` nao existe
nesse mapeamento por design da biblioteca (ela so oferece PRELIM para SINAN).
A classe `Database.load(directories=[...])` aceita uma lista explicita de
`Directory` que sobrescreve `self.paths` para aquela chamada:

```python
from pysus.ftp import Directory
from pysus.ftp.databases.sim import SIM

sim = SIM()
sim.load(directories=[Directory("/dissemin/publicos/SIM/PRELIM/DORES")])
```

Isso funciona porque o formatter da classe `SIM` decodifica o nome do arquivo
por posicao de caracteres (`nome[:-6]`, `nome[-6:-4]`, `nome[-4:]`) —
`DOBA2025.dbc` vira grupo `DO`, UF `BA`, ano `2025` independentemente da arvore
de origem. Validado ao vivo contra o FTP oficial: 56 arquivos listados em
`PRELIM/DORES`, decodificados corretamente (25/26 anos, 27 UFs + 1 arquivo
`DOBR*.dbc` agregado nacional, explicitamente ignorado pelo coletor —
constante `_IGNORAR_UF_AGREGADA = "BR"`).

Cada parte baixada e registrada num manifesto isolado
(`data/bronze/prelim/sim_parts/sim_prelim_manifest.json`, nunca compartilhado
com o manifesto consolidado) com proveniencia do `.dbc` bruto: nome do arquivo
de origem, data/hora de extracao e SHA-256 do `.dbc` — nao apenas do parquet
decodificado.

O download em si **nao** usa `pysus.ftp.File.download()`. Validado ao vivo
(rodando `--prelim` fora do sandbox de desenvolvimento): esse metodo nao
preserva o `.dbc` bruto — `Data(str(filepath))`, chamado dentro do proprio
`download()`, converte `.dbc -> .dbf -> parquet` de forma sincrona, e cada
etapa (`dbc_to_dbf`/`dbf_to_parquet` em `pysus/data/__init__.py`) apaga o
arquivo de entrada assim que gera a proxima etapa. Ou seja, quando
`File.download()` retorna, o `.dbc` original ja nao existe mais — so resta o
`.parquet` final, tarde demais para hashear a proveniencia.

Por isso o coletor faz o RETR do `.dbc` manualmente com
`pysus.ftp.FTPSingleton` (a mesma conexao que `File.download()` usaria
internamente), hasheia o arquivo em disco, e so entao entrega esse `.dbc` para
`pysus.data.local.Data` decodificar — reaproveitando a decodificacao real do
pysus (que depende da extensao C `pyreaddbc`) sem reimplementa-la.

### Silver: `data-pipeline/silver_prelim.py`

Espelha `~95%` de `data-pipeline/silver_v2.py` (mesma extracao de idade, sexo,
geografia e o mesmo filtro CID por prefixo). Deliberadamente duplicado em vez
de parametrizado: acoplar a Silver consolidada (ja testada e em uso) a um
formato de manifesto diferente introduziria risco desnecessario na camada que
funciona. Ao contrario da consolidada, a Silver preliminar **nao tem modo
"legado sem manifesto"** — uma entrada sem `dbc_sha256`/`extracted_at` no
manifesto e rejeitada (`ValueError`), porque proveniencia auditavel e
obrigatoria para dado ainda nao revisado.

Toda linha carrega, alem dos campos do contrato consolidado:

| Campo | Tipo | Descricao |
|---|---|---|
| `is_preliminar` | `BOOLEAN` | Sempre `TRUE` nesta camada. |
| `data_extracao` | `DATE` | Quando o `.dbc` de origem foi baixado. |
| `arquivo_origem` | `VARCHAR` | Nome do arquivo `.dbc` de origem (ex.: `DOBA2025.dbc`). |
| `sha256_origem` | `VARCHAR` | SHA-256 do `.dbc` bruto. |

#### Filtro cientifico (identico ao consolidado)

- **CID-10 por prefixo, nunca por comparacao de string**: o codigo valido e
  `LEFT(cid_grupo,1) = 'V' AND TRY_CAST(SUBSTR(cid_grupo,2,2) AS INTEGER)
  BETWEEN 1 AND 89` — extrai os dois digitos numericos apos o `V` e compara o
  **inteiro** contra a faixa 1-89. O anti-padrao `BETWEEN 'V01' AND 'V89'`
  (comparacao lexicografica da string completa) existia na `silver.py`
  pre-pivot do projeto e nunca foi usado nesta camada.
- **TIPOBITO**: confirmado em [`Estrutura_do_SIM_2025.md:25`](Estrutura_do_SIM_2025.md)
  — "1 - Tipo do obito TIPOBITO Caracter 1 1 - Fetal; 2-Nao Fetal". O filtro
  analitico exige `tipobito_raw = '2'` (nao fetal), mesmo codigo da
  consolidada.
- **Contagem**: `record_id = sha256(CONCAT(sha256_origem_ou_arquivo, ':',
  numero_da_linha))`, garantindo unicidade mesmo sem `COUNT(*)`.

### Gold: `data-pipeline/sim_prelim_gold.py`

Espelha `sim_evidence.materializar_mart_municipal`, com duas diferencas
deliberadas para esta camada:

1. **`total_obitos` usa `COUNT(DISTINCT record_id)` como contagem primaria**
   (a consolidada usa `COUNT(*)` como primaria e reporta
   `COUNT(DISTINCT record_id)` so como auxiliar de auditoria, porque a Silver
   v2 ja passou por QA). A preliminar tem menos garantia de deduplicacao no
   momento da ingestao, entao a contagem primaria aqui e a mais conservadora;
   `registros_brutos` (`COUNT(*)`) fica disponivel como auxiliar.
2. Carrega `is_preliminar`, `data_extracao` (mais recente do grupo),
   `arquivo_origem` e `sha256_origem` (agregados via `STRING_AGG(DISTINCT ...)`
   quando o grupo mensal combina mais de um arquivo de origem).

Artefatos gerados, sempre em `data/gold/`, nunca sobrescrevendo os
equivalentes `sim_v1_*`:

- `sim_prelim_municipio_mes_ocorrencia.parquet`
- `sim_prelim_municipio_mes_residencia.parquet`

## Indicador de completude

Calculado sob demanda (nao materializado como artefato — e uma consulta SQL
dentro do router da API) por UF e mes do ano preliminar:

```
completude_estimada(uf, mes, ano) =
    obitos_prelim(uf, mes, ano) / media(obitos_consolidado(uf, mes, ate 3 anos consolidados mais recentes anteriores a `ano`))
```

A consulta so le agregados ja materializados de cada camada (leitura pura);
nunca junta as linhas das duas camadas numa mesma agregacao de `UNION`. E um
**sinal de maturidade da captacao** (quanto do volume tipico daquele mes ja
chegou), exibido ao lado do numero absoluto — nunca usado para corrigir,
ajustar ou extrapolar uma contagem.

Quando um mes nao tem dado preliminar ainda (comum: a captacao preliminar
comeca cedo mas cresce ao longo do ano), `obitos_prelim` e
`completude_estimada` retornam `null` para aquele mes, nunca `0` — ausencia de
dado nao e o mesmo que zero obitos.

## API: `GET /api/sim/prelim/*`

Router isolado (`backend/routers/sim_prelim.py`, prefixo
`/api/sim/prelim`), registrado em paralelo a `/api/sim/*` — nenhum parametro
em `/api/sim/*` habilita dado preliminar, e nenhum destes endpoints le os
marts consolidados exceto para o `JOIN` de leitura do calculo de completude.

| Endpoint | Descricao |
|---|---|
| `GET /api/sim/prelim/summary` | Total, municipios cobertos e serie mensal, filtrveis por `dimensao`/`uf`/`ano`. |
| `GET /api/sim/prelim/municipios` | Lista paginada por municipio. |
| `GET /api/sim/prelim/completude` | Indicador de completude por mes (`ano` obrigatorio). |
| `GET /api/sim/prelim/metadata` | Catalogo dinamico dos artefatos preliminares (calculado a cada chamada — ao contrario do catalogo consolidado, que e um snapshot JSON versionado, a base preliminar muda a cada ingestao). |

Toda resposta carrega o bloco `aviso_preliminar`:

```json
{
  "preliminar": true,
  "data_extracao": "2026-08-20",
  "completude_estimada": 0.62,
  "texto": "Dados preliminares do SIM, sujeitos a revisao e ainda em captacao. Nao comparaveis com anos consolidados."
}
```

Antes da primeira execucao de `--prelim`, os endpoints que dependem de um
mart Gold (`summary`, `municipios`, `completude`) retornam `503` com uma
mensagem explicita orientando a rodar a ingestao — nunca um corpo vazio
disfarcado de dado valido.

## Interface: aba "Dados preliminares"

Tela dedicada (`/preliminares`) com:

- faixa de aviso **persistente** (nao um toast) no topo, marcando toda a tela
  como preliminar;
- grafico combinando a serie consolidada de referencia (linha solida) com a
  serie preliminar do ano corrente (linha tracejada + legenda explicita);
- aviso especifico bloqueando comparacao direta entre o ano preliminar e um
  ano consolidado, explicando a razao (captacao incompleta, nao queda real);
- tabela de municipios com marcacao visual permanente (icone de alerta) em
  cada linha;
- tratamento explicito do estado "ainda nao ingerido" (503), com o comando
  exato para popular os dados.

No catalogo "Dados e metadados" (`/dados`), os datasets preliminares aparecem
ao lado dos consolidados com estado `preliminary` (distinto de `validated` e
`partial`), vindos do `GET /api/sim/prelim/metadata` dinamico — nunca do
catalogo estatico `docs/metadata/catalogo_dados.json`, que documenta somente a
camada consolidada.

## Executando a ingestao preliminar

```bash
uv run python -m data-pipeline.run --prelim --ufs BA --prelim-anos 2025 2026
# ou, para o Brasil inteiro:
uv run python -m data-pipeline.run --prelim --ufs ALL --prelim-anos 2025 2026
```

Orquestra Bronze -> Silver -> Gold preliminar
(`baixar_sim_prelim_streaming` -> `processar_silver_sim_prelim` ->
`materializar_marts_prelim`) sem tocar em nenhum artefato consolidado.

## Testes

`tests/test_sim_prelim.py` cobre os contratos obrigatorios desta camada:
Silver marca `is_preliminar=true` e propaga proveniencia; Gold deduplica por
`record_id`; nenhum modulo consolidado referencia `prelim` no codigo-fonte;
os quatro valores de regressao da camada consolidada (BA 2024, BA 2010-2024,
Brasil 2024, Salvador 2024) permanecem exatamente os mesmos; todo endpoint
`/api/sim/prelim/*` devolve `aviso_preliminar`; os endpoints antigos nunca
vazam dado preliminar sob nenhuma combinacao de parametros.
