# V01–V89 · Design System v2.1

Especificação de interface do sistema de vigilância de mortalidade viária
(SIM/DATASUS · IBGE · SENATRAN — recorte CID-10 V01–V89).

Esta é a **versão adaptada e enxugada** da proposta gerada no Claude Design.
O que foi mantido, corrigido e cortado está registrado em `DECISOES.md`.
Os tokens vivem em `tokens.css` e são a única fonte de verdade de cor.
A referência visual navegável está em `design-system.html`.

> **Como um agente deve usar este documento.** Leia inteiro antes de editar
> qualquer arquivo. Implemente na ordem das fases descritas em
> `PROMPT_DESIGN_SYSTEM.md`. Onde este documento conflitar com o código
> existente, este documento vence — exceto quando a mudança quebrar dado,
> rota ou teste, caso em que pare e relate.

---

## 0 · A tese

O sistema atual herdou a linguagem visual de um template SaaS: azul saturado,
cards com sombra, paleta arco-íris nas pizzas, gráfico sem denominador à vista.
Ele parece um dashboard de produto.

O que ele é, na verdade, é um **instrumento de vigilância epidemiológica**: cada
figura precisa poder sair da tela e entrar numa monografia com citação, fonte,
denominador e ressalva de método. O design system inteiro serve a isso.

Três consequências práticas, e tudo o mais decorre delas:

1. **Toda tela abre com uma frase que já responde à pergunta**, com os números
   dentro dela. Gráfico é evidência, não enigma.
2. **Taxa antes de contagem.** O valor do trabalho está no denominador —
   população IBGE e frota SENATRAN. A contagem absoluta é contexto secundário.
3. **Proveniência à vista.** Fonte, recorte, data de extração e versão do dado
   acompanham cada figura, na tela e na exportação.

---

## 1 · A regra de ouro da cor

> **Dado preenche. Interface traça.**

Uma cor de **dado** (rampa de risco, paleta categórica) só aparece como
preenchimento de área: barra, fatia, feição de mapa, célula de heatmap.

Uma cor de **interface** (marca, foco, estados) só aparece como traço, ponto,
ícone ou texto.

Nenhuma cor cruza a fronteira. Isso resolve, sem inventar cores novas, a
ambiguidade que existe hoje — em que `--primary` é ao mesmo tempo a cor de link,
o azul das barras e o "baixo" da escala do mapa.

Corolários que devem ser respeitados literalmente:

- Botão, link, chip, aba ativa e borda de foco **nunca** usam `--risk-*`,
  `--cat-*` ou qualquer cor derivada de valor.
- Barra, fatia, feição e heatmap **nunca** usam `--brand`, `--ok`, `--alert`.
- Um estado de erro não é um preenchimento vermelho: é uma régua de 1,5px em
  `--alert`, um ícone e texto. O vermelho da rampa (`--risk-5`) continua livre
  para significar "alta mortalidade" sem que ninguém leia "erro".

---

## 2 · Tipografia

**Duas famílias.** IBM Plex Sans e IBM Plex Mono, ambas OFL, carregadas por
`next/font/google` com `subsets: ['latin']` e `display: 'swap'`.

*(A proposta original trazia uma terceira família, IBM Plex Serif, para o
parágrafo de abertura. Foi cortada: custa ~90 KB por uma voz que contraste de
tamanho e peso já produz, e serifa misturada a sans reduz velocidade de
varredura num painel denso. Se você quiser reativá-la depois, é uma linha no
carregamento da fonte e a troca de `--font-sans` por `--font-serif` no lede.)*

| Papel | Especificação | Exemplo |
|---|---|---|
| lede | 21px / sans 400 / line-height 1,5 / max 82ch | *A mortalidade voltou ao patamar de 2010.* |
| hero | 34px / **mono 500** / tabular | `20,3 /100 mil` |
| h1 | 26px / sans 600 / letter-spacing −0,02em | Onde as pessoas morrem |
| h2 | 20px / sans 600 | Concentração temporal por município |
| h3 | 16px / sans 600 | Óbitos por tipo de vítima |
| corpo | 15px / sans 400 / line-height 1,6 | Denominador populacional do IBGE, tabela 6579. |
| meta | 13px / sans 400 / cor `--ink-2` | SIM/DATASUS · extração 05/08/2026 |
| rótulo | 11px / **mono 500** / letter-spacing 0,12em / caixa alta | `DIMENSÃO · OCORRÊNCIA` |

**Regra dura:** todo número que o usuário possa querer comparar, copiar ou
citar é **mono tabular**. Isso vale para KPI, célula de tabela, tick de eixo,
valor de tooltip e a taxa dentro de uma frase. Em Sans, os dígitos mudam de
largura e as colunas dançam a cada filtro.

Separador decimal e milhar em pt-BR (`toLocaleString('pt-BR')`), sempre.
Taxa com uma casa decimal; contagem sem casa decimal; percentual com uma casa.

---

## 3 · Cor

Os valores canônicos estão em `tokens.css`. O que segue é o **contrato de uso**.

### 3.1 Superfície e tinta

Neutros levemente quentes, não o *slate* azulado do Tailwind.
`--ink-2` tem 6,3:1 no branco — o `#94a3b8` usado hoje tem 2,6:1 e reprova em
AA justamente nas notas metodológicas, que são o texto mais importante da tela.

### 3.2 Rampa de risco — o único gradiente do sistema

Cinco degraus de uma só matiz, com luminância estritamente decrescente
(Y = 0,849 → 0,678 → 0,469 → 0,264 → 0,108). Consequências verificadas:

- imprime corretamente em escala de cinza (a monografia pode ser impressa em P&B);
- é segura para deuteranopia e protanopia, porque a ordem é dada por
  luminância, não por matiz;
- é comparável entre consultas, **desde que as classes sejam fixas** (§7).

Rótulo sobre a rampa: `--on-risk-lo` (tinta) sobre risk-1 a risk-3;
`--on-risk-hi` (canvas) sobre risk-4 e risk-5. Não improvisar.

### 3.3 Categórico — tipo de vítima

Quatro matizes de mesma luminância e mesmo croma (OKLCH L=0,52 · C=0,088), mais
um neutro. Nenhuma categoria parece mais grave por acidente de cor; a ênfase
vem de ordenação e peso tipográfico, nunca de matiz.

| Token | Hex | Categoria |
|---|---|---|
| `--cat-moto` | `#686098` | Motociclista |
| `--cat-pedestre` | `#676F2F` | Pedestre |
| `--cat-auto` | `#02787D` | Ocupante de automóvel |
| `--cat-ciclista` | `#8B5479` | Ciclista |
| `--cat-outros` | `#8A9096` | Outros / não especificado |

**"Outros / não especificado" é cinza de propósito.** Nos dados da Bahia essa
categoria tem 8.842 registros — é a segunda maior. Pintá-la de uma cor
confiante afirma um conhecimento que não existe. Em cinza, ela diz a verdade:
*não sabemos*. Categorias além destas cinco são agrupadas em "Outros"; a paleta
não se estende.

### 3.4 Estado de UI

`--attention` marca **incerteza**, e é o token mais importante do trabalho
depois da rampa: população estimada de outro ano, dado preliminar, denominador
ausente, frota não pareada. Aparece como ponto de 6px, régua de 1,5px ou ícone.
Quando o mesmo estado precisa virar texto corrido, use `--attention-ink`
(7,6:1) — `--attention` puro reprova em AA para texto pequeno.

---

## 4 · Superfície, borda e espaço

- **Borda em vez de sombra.** As três sombras atuais e o *glow* vermelho criam
  profundidade sem informação. Numa tela densa, régua de 1px separa melhor e
  imprime melhor. A única sombra que permanece é `--shadow-pop`, e só em
  elemento que de fato flutua (popover, menu).
- **Raio 6px** em card e painel, **4px** em controle. Nada de 12/16px.
- **Escala de espaço base 4**: 4 · 8 · 12 · 16 · 24 · 32 · 48.
- Grade de conteúdo com largura máxima de 1240px; texto corrido nunca passa de
  82ch.

---

## 5 · Componentes

Sete componentes carregam a tela. Cada um substitui algo que existe hoje.

### 5.1 `<Lede>` — novo · um por tela, no topo, nunca dois

O parágrafo que responde à pergunta da tela, com os números embutidos em mono.
Marcado por uma régua vertical de 3px em `--risk-5`, um rótulo mono acima e a
identificação da regra que o produziu.

```
props: { rotulo, texto | segmentos, regra, gerado: boolean }
```

Se nenhuma regra passar, o componente **diz que suprimiu a leitura e explica
por quê** — não fica em branco (ver §6.2).

### 5.2 `<KpiStat>` — substitui `KpiCard.tsx`

Quatro por linha, no máximo. Sem ícone colorido dentro (o quadrado com ícone
compete com o próprio valor e sai). Estrutura fixa:

```
rótulo (11px mono, --ink-3)
valor  (34px mono 500)  unidade (13px, --ink-2)
delta  (13px mono, com seta ▲▼)  ·  referência explícita ("vs 2018")
denominador (13px, --ink-2) — SEMPRE presente quando o valor é taxa
```

O denominador não é opcional. "20,3 /100 mil" sem "População IBGE 2024 ·
14.850.513 hab. · tabela 6579" logo abaixo é um número não auditável.

### 5.3 `<RankedBar>` — substitui as duas `PieChart`

Barras horizontais ordenadas, percentual à direita, valor em mono. A primeira
categoria recebe a cor da categoria; as demais recebem `--hairline`, salvo
quando a comparação **entre** categorias for o assunto — aí todas recebem sua
cor categórica.

Motivo de aposentar a pizza: com nove fatias e paleta arco-íris, a leitura de
proporção é pior que uma barra ordenada, e a cor sugere severidade que não
existe. **`PieChart` só é permitido com ≤ 4 categorias.**

### 5.4 `<GraficoMoldura>` — novo · o componente mais importante

Envelope obrigatório de **todo** gráfico da aplicação. É ele que garante que
nenhuma figura saia da tela sem contexto:

```
┌─ título de medida (h3) ───────────── [?] ─┐   ← camada 1, fixa
│  nota de método (13px, --ink-2)           │   ← camada 2, fixa
│  ┌─────────────────────────────────────┐  │
│  │            o gráfico                │  │
│  └─────────────────────────────────────┘  │
│  legenda em DOM (não a <Legend/> da lib)  │
│  leitura do recorte  · regra: R1          │   ← camada 3, gerada
│  fonte · recorte · extração · versão      │   ← proveniência
└───────────────────────────────────────────┘
```

O `[?]` abre a explicação longa (§6.3). A legenda é DOM e não do Recharts,
porque precisa ser **o mesmo texto** que vai na figura exportada.

### 5.5 `<ClassLegend>` — substitui `MapLegend.tsx`

Cinco caixas com os limites numéricos das classes fixas, mais a caixa hachurada
de "sem dado". Nunca um gradiente contínuo sem rótulo — gradiente sem número
não é legenda, é decoração.

### 5.6 `<BarraDeRecorte>` — novo · cabeçalho fixo

Chips com o recorte ativo (UF, período, dimensão geográfica, faixa CID),
`N = …` do recorte à direita, e dois botões: **link do recorte** (URL que
reproduz exatamente o estado) e **exportar**.

O link do recorte é o que torna o sistema citável: a monografia cita a URL,
não o *print*.

### 5.7 `<SeloQualidade>` — novo

Marcador discreto de incerteza, reutilizado em toda a aplicação: ponto de 6px em
`--attention` + `title`/tooltip explicando o motivo. Usado em população
estimada, dado preliminar e frota ausente (§7).

---

## 6 · Texto: as três camadas

Esta seção é o coração do pedido de "textos bem explicativos". Todo texto da
interface pertence a exatamente uma destas camadas, e cada camada tem dono,
estabilidade e tom diferentes. Misturá-las é o erro mais comum.

### 6.1 As camadas

| | Camada 1 · **Título de medida** | Camada 2 · **Nota de método** | Camada 3 · **Leitura do recorte** |
|---|---|---|---|
| o que é | O que está sendo medido e com qual denominador | Denominador, critério de inclusão, limite de interpretação | Frase derivada do payload filtrado |
| muda com filtro? | não | não | **sim** |
| contém número? | não | não | sim |
| afirma achado? | não | não | sim, com regra identificada |
| onde vive | `content/medidas.ts` | `content/metodo.ts` | `lib/leitura/*.ts` |
| exemplo | "Taxa por 100 mil habitantes e óbitos absolutos, por ano" | "Denominador populacional do IBGE do mesmo ano quando disponível; quando ausente, o ano mais próximo, marcado na interface" | "No recorte, a taxa passou de 18,2 em 2010 para 20,3 em 2024 — alta de 11,6%." |

Camadas 1 e 2 são **escritas uma vez** e revisadas em *code review*. Camada 3 é
gerada, e a interface **sempre a identifica como gerada**, nomeando a regra.
Isso é o que permite auditá-la numa banca.

### 6.2 Motor de leitura — versão reduzida

A proposta original trazia dez regras. Para o escopo atual, implemente
**três regras e duas guardas**, com teste unitário cada. As demais ficam
documentadas como trabalho futuro.

**Regras (produzem frase):**

| id | precondição | gabarito |
|---|---|---|
| `R1` tendência | `serie.length ≥ 3` | "A taxa passou de `{v0}` em `{a0}` para `{v1}` em `{a1}` — {alta\|queda} de `{pct}`. Mínimo da janela: `{vmin}` em `{amin}`." |
| `R2` concentração | `municipios ≥ 5` | "Os `{k}` municípios de maior contagem somam `{pct}` dos óbitos do recorte, liderados por {mun} com `{n}`." |
| `R3` divergência | tem população pareada | "Ordenado por contagem, {mun} lidera; por taxa cai para a `{p}`ª posição. No topo por taxa: {mun2}, `{r}`× a taxa do líder absoluto." |

**Guardas (suprimem a frase e explicam):**

| id | precondição | saída |
|---|---|---|
| `G1` n insuficiente | `total < 20` | "Com `{n}` óbitos no recorte, a taxa oscila mais de 10 pontos com um caso a mais. A leitura foi suprimida." |
| `G2` evento único | maior dia > 50% do total | "`{pct}` dos óbitos do recorte ocorreram num único dia (`{data}`). O recorte descreve um evento, não risco habitual." |

**`G2` é o caso Gavião** e é a contribuição metodológica própria deste
trabalho: em 2024, os 20 óbitos do município ocorreram todos em janeiro, e a
matéria do G1 documenta um único acidente na BR-324. Um sistema que reporta a
taxa anual de Gavião sem essa guarda produz um número tecnicamente correto e
epidemiologicamente enganoso. A guarda deve disparar automaticamente e a frase
deve aparecer na tela — é isso que diferencia este sistema de um dashboard.

Guardas têm precedência sobre regras. Se `G1` ou `G2` disparar, nenhuma regra
produz frase naquela tela.

**Léxico — o que a camada 3 nunca escreve:**

- verbo causal: "provoca", "explica", "por causa de", "responsável por";
- superlativo sem denominador: "o município mais perigoso da Bahia";
- projeção ou tendência futura a partir da série filtrada;
- adjetivo de alarme: "alarmante", "explosão", "tragédia", "epidemia";
- frase que continuaria verdadeira em qualquer recorte — se não usa nenhum
  valor do payload, não é leitura.

### 6.3 Botão de ajuda `[?]`

O `[?]` de cada `<GraficoMoldura>` abre um *popover* com três blocos curtos, e
nada além disso:

1. **O que este gráfico mostra** — 1 a 2 frases, linguagem comum, sem jargão.
2. **Como ler** — o que o eixo, a cor e o tamanho significam aqui.
3. **O que ele não permite concluir** — a ressalva honesta. Ex.: "Taxa por
   100 mil em municípios pequenos é instável: um óbito a mais muda o valor em
   dezenas de pontos."

O terceiro bloco é obrigatório. Um botão de ajuda que só elogia o gráfico não
ajuda ninguém.

Regras: o conteúdo vive em `content/ajuda.ts`, indexado pelo id da medida;
o popover fecha com `Esc` e clique fora; o botão tem `aria-label` descritivo
("Como ler: taxa por 100 mil habitantes"); nunca abre modal.

---

## 7 · Qualidade do dado na interface

Três situações que o pipeline já conhece e que a interface hoje esconde.
Todas usam `<SeloQualidade>` e `--attention` — nunca vermelho, porque vermelho
já significa mortalidade alta.

**a) População estimada de outro ano.** Quando o par município-ano não tem
população IBGE e o sistema usa o ano mais próximo, o valor exibe o selo e o
tooltip diz qual ano foi usado: *"População de 2022 (ano mais próximo
disponível). A taxa é aproximada."* Se mais de 5% dos pares do recorte forem
aproximados, a `<GraficoMoldura>` exibe o aviso no rodapé, não só nas células.

**b) Dado preliminar (2025+).** Nunca no mesmo eixo que o consolidado sem
quebra visual. A série preliminar recebe `--hatch-prelim` (área) ou traço
tracejado (linha), uma régua vertical em `--attention` marcando o início do
período preliminar, e o rótulo `PRELIMINAR · COBERTURA PARCIAL`. O tooltip
informa a completude estimada. **O padrão dos filtros exclui preliminares**; o
usuário precisa pedir por eles explicitamente.

**c) Sem dado.** Hachura (`--hatch-nd`), nunca branco — branco lê como zero.
Vale para feição de mapa, célula de tabela e ponto de série. Célula sem dado
mostra `N/D`, jamais `0` e jamais vazio.

---

## 8 · Mapa

**Não troque a biblioteca de mapa.** A proposta original sugeria migrar para
MapLibre + deck.gl; isso é uma reescrita e não é o que produz valor agora.
Aplique o que segue à biblioteca que o projeto já usa.

A correção estrutural, essa sim indispensável:

> Hoje a rampa vai do mínimo ao máximo **do recorte**. Isso faz o mesmo
> município mudar de cor entre duas consultas, e a legenda deixa de ser
> comparável. Passe a usar **classes fixas**, calculadas uma única vez sobre a
> série inteira 2010–2024 e congeladas em código.

Os cortes já estão em `tokens.css` (`--break-1..4` = 12 · 18 · 26 · 39, quintis
de taxa por 100 mil). O filtro repinta feições; a legenda nunca muda.

Demais regras:
- contorno de feição em `--hairline`, 0,6px — não pode competir com a rampa;
- *hover* por estado da feição, nunca recarregando a fonte de dados;
- sem dado = hachura, com a classe presente na legenda;
- moldura do mapa carrega título da medida, recorte completo, legenda de
  classes, barra de escala em km e proveniência — os mesmos elementos que vão
  para a exportação.

---

## 9 · Gráficos

A biblioteca de gráfico permanece a atual. O que muda é que **nenhuma página
passa cor, fonte ou tamanho de tick**: cada série pede um preset nomeado por
função semântica, e a cor de uma feição sai da **classe do valor**, nunca do
índice da série.

```ts
// src/lib/theme/chart.ts — único módulo que conhece cor de série
export const grid  = { horizontal: true, vertical: false, stroke: t.chartGrid }
export const axisX = { tickLine: false, dy: 6,
  axisLine: { stroke: t.hairline },
  tick: { fontSize: 11, fill: t.ink3, fontFamily: t.mono } }
export const axisY = { ...axisX, axisLine: false, width: 56 }

export const serie = {
  taxa:      { stroke: t.risk5,  strokeWidth: 2.5, dot: false },
  absoluto:  { fill:   t.risk2,  stroke: 'none' },
  referencia:{ stroke: t.chartRef, strokeWidth: 1.5, strokeDasharray: '4 4' },
  preliminar:{ stroke: t.attention, strokeWidth: 2, strokeDasharray: '5 4' },
}
// Trilho de hover Recharts: token --chart-cursor (discreto, distinto de --hairline)
export const cursor = { fill: 'var(--chart-cursor)' }

export const RISK5  = [t.risk1, t.risk2, t.risk3, t.risk4, t.risk5]
export const BREAKS = [12, 18, 26, 39]
export const porClasse = (v: number) => RISK5[BREAKS.filter(b => v >= b).length]
```

Regras de comportamento:

- `isAnimationActive={false}` — o dado muda por filtro, e animação sugere
  transição temporal que não existe;
- `<Legend/>` nativo proibido: a legenda é DOM, no rodapé da moldura;
- tooltip sempre customizado, com valor, denominador, N e selo de aproximação;
- `dot={false}`, com ponto de referência apenas no mínimo e no último ponto;
- domínio do eixo derivado do recorte com folga fixa — nunca `'auto'` puro,
  que achata a variação;
- eixo de taxa **não** começa forçadamente em zero; eixo de contagem **sim**.

---

## 10 · Navegação e rótulos

Menu lateral de 248px, agrupado, com rótulo de grupo em mono caixa-alta.

```
PANORAMA      Visão geral · Séries no tempo
TERRITÓRIO    Ranking municipal · Mapa · Fluxos entre municípios
MÉTODO        Qualidade e preliminares · Dados e metadados
              Exploração em linguagem natural
```

**Renomeie apenas os rótulos; mantenha os caminhos de rota como estão.**
A proposta original fundia e renomeava rotas. Isso quebraria links, capturas já
inseridas no artigo e a memória muscular de quem já usa o sistema — custo alto,
ganho estético. Se a fusão for desejada depois, faça com `redirect` e num PR
próprio.

Item ativo: fundo `--brand-soft`, texto `--brand-ink`, régua esquerda de 2px em
`--brand`. Ícone só em item de navegação e botão de ação — **nenhum ícone
dentro de KPI, título ou legenda.** Traço 1,5px em 16/18px.

Rodapé fixo do menu com a proveniência global:
`CID-10 V01–V89 · SIM/DATASUS · IBGE 6579 · SENATRAN dez. · extração {data} · {sha}`

---

## 11 · Exportação

Exportar é requisito funcional, não conveniência: as figuras da monografia
saem daqui.

- **PNG @2x** do gráfico ou mapa **com a moldura rasterizada junto** — título,
  legenda, ressalva e proveniência fazem parte da imagem. Uma figura exportada
  sem moldura não é citável.
- **CSV** com numerador e denominador em colunas separadas, para que a taxa
  possa ser recalculada fora do sistema.
- Nome do arquivo carrega o recorte:
  `v01v89_ba_2010-2024_ocorrencia_taxa100k@2x.png`
- **A exportação é sempre renderizada em tema claro**, mesmo que a tela esteja
  em tema escuro. A monografia é impressa.

*(Exportação GeoJSON ficou fora deste escopo.)*

---

## 12 · Acessibilidade — mínimo não negociável

- Contraste AA para todo texto: `--ink` 15,2:1 · `--ink-2` 6,3:1 ·
  `--brand` 6,8:1 · `--attention-ink` 7,6:1. `--ink-3` (3,5:1) só em rótulo
  ≥ 11px com peso 500, nunca em texto corrido.
- Foco visível em todo elemento interativo (`--focus`, 2px, offset 2px).
- Cor nunca é o único canal: a rampa é ordenada por luminância, categorias
  têm rótulo textual, e incerteza tem ponto + tooltip textual.
- `prefers-reduced-motion` respeitado.
- Tabela com `<caption>` e `<th scope>`; gráfico com resumo textual
  equivalente — a camada 3 já cumpre esse papel quando presente.

---

## 13 · O que este sistema não faz

Registre como decisão explícita, não como omissão:

- não usa sombra para hierarquia;
- não usa mais de cinco categorias de cor simultâneas;
- não anima transição de dado;
- não exibe taxa sem denominador ao lado;
- não pinta "sem dado" de branco;
- não deixa a escala do mapa variar com o filtro;
- não escreve frase causal a partir de dado observacional;
- não mostra dado preliminar junto do consolidado sem marcação.
