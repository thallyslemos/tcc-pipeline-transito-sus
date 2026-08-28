# Reconciliação metodológica com o ONSV — DATASUS 2024

**Data da verificação:** 2026-08-01
**Branch:** `audit/silver-sim-qa`

## Resultado

Os totais publicados pelo ONSV foram reproduzidos exatamente a partir dos
arquivos SIM já existentes localmente, desde que:

1. o universo seja **Brasil por município de ocorrência** (`CODMUNOCOR`);
2. o filtro de causa use o prefixo **V0–V8** de `CAUSABAS`;
3. as cópias idênticas de arquivos Bronze sejam contadas uma única vez.

| Ano | ONSV publicado | Reprodução local deduplicada | Diferença |
|---:|---:|---:|---:|
| 2023 | 34.881 | 34.881 | 0 |
| 2024 | 37.150 | 37.150 | 0 |

Essa reprodução elimina a hipótese de que o total do ONSV seja incompatível
com o SIM local. A diferença observada anteriormente veio principalmente de
escopo geográfico e duplicação da ingestão.

## Metodologia identificada

O estudo de 2024 carrega o objeto `rtdeaths` do pacote R
[`roadtrafficdeaths`](https://pabsantos.github.io/roadtrafficdeaths/) e seu
repositório [ONSV/analise-datasus-2024](https://github.com/ONSV/analise-datasus-2024).
O código de preparação está no arquivo
[`data-raw/rtdeaths.R`](https://github.com/pabsantos/roadtrafficdeaths/blob/main/data-raw/rtdeaths.R).

As regras relevantes são:

- fonte: `microdatasus::fetch_datasus(year_start = 1996, year_end = 2024,
  information_system = "SIM-DOEXT")`;
- causa: `substr(CAUSABAS, 1, 2)` em `V0`, ..., `V8`;
- geografia publicada: `CODMUNOCOR`, isto é, município de ocorrência;
- tempo: `DTOBITO`, convertido para `ano_ocorrencia`;
- sexo: `SEXO == 1` masculino, `SEXO == 2` feminino, demais valores `NA`;
- idade: decodificação própria para `IDADE`, com unidades 0–3 convertidas para
  zero, unidade 4 em anos e unidade 5 em 100+;
- o código não aplica no R uma regra explícita `TIPOBITO = 2`; no recorte
  Bronze local, todos os registros que atendem ao prefixo V0–V8 possuem
  `TIPOBITO = 2`.

O filtro `V0–V8` é equivalente às categorias de acidentes de transporte
terrestre `V01–V89` para a agregação por capítulo, mas é menos explícito que o
contrato Silver v2 do projeto.

## Evidência da duplicação local

O inventário encontrou **557 arquivos observados** e **405 arquivos canônicos**;
152 eram cópias de conteúdo dentro da mesma UF/ano. Em 2024:

- Brasil, ocorrência, deduplicado: **37.150**;
- Brasil, ocorrência, com cópias: **78.234**;
- excesso atribuível às cópias: **41.084**;
- Bahia, ocorrência, deduplicado: **3.105**;
- Bahia, residência, deduplicado: **3.041**.

Portanto, os valores não devem ser comparados sem declarar simultaneamente
**escopo geográfico**, **campo municipal**, **snapshot** e **política de
deduplicação**.

## Decisão metodológica para o TCC

O ONSV será usado como referência diagnóstica de **ocorrência Brasil** e como
teste de integridade da ingestão. O núcleo científico permanece separado:

- Gold principal: óbitos de residentes na Bahia por município de residência,
  ano/mês, CID V01–V89 e população residente;
- Gold secundário: óbitos por município de ocorrência, explicitamente rotulado
  como ocorrência;
- nenhuma tabela agregada poderá misturar residência e ocorrência sob o mesmo
  indicador.

## Produto de auditoria

O backend expõe os agregados e as regras em
`GET /api/dashboard/auditoria/onsv-2024`. A tela `/auditoria` apresenta os
totais publicados, a reprodução deduplicada, o excesso por cópias e a matriz
de metodologias. O endpoint não retorna microdados, nomes de arquivos nem
caminhos absolutos.
