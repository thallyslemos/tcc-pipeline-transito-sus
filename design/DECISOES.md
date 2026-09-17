# Revisão da proposta do Claude Design — o que ficou, o que mudou, o que saiu

Registro das decisões tomadas ao adaptar os quatro *artboards* gerados no
Claude Design (`referencia/`) para a especificação implementável
(`DESIGN_SYSTEM.md` + `tokens.css`).

Critério aplicado em tudo: **valor de leitura por hora de implementação**, com
o trabalho de conclusão de curso em fase final. Mudança que melhora a
interpretação do dado entra; mudança que só melhora o acabamento espera.

---

## A · Mantido (a proposta acertou)

| Item | Por quê |
|---|---|
| Neutros quentes, régua de 1px, sem sombra, raio 4/6 | Densidade maior sem ruído, e imprime bem — a monografia é impressa |
| Mono tabular em todo número | Colunas param de dançar ao filtrar; é a mudança mais barata com efeito mais visível |
| Rampa sequencial única para risco, com **classes fixas** | A correção estrutural mais valiosa do conjunto inteiro (ver §C-1) |
| Azul institucional só para interface | Elimina a ambiguidade do `--primary` atual |
| Três camadas de texto (medida fixa / método fixo / leitura gerada) | Resolve de uma vez o pedido de "textos explicativos" e o de auditabilidade |
| KPI com denominador visível | Taxa sem denominador não é auditável |
| Sem-dado = hachura, nunca branco | Branco lê como zero, e zero é uma afirmação |
| Rodapé de proveniência em toda figura | Requisito real: a figura precisa ser citável |
| Exportação PNG @2x com a moldura junto | É por onde as figuras do artigo saem |
| Aposentar as `PieChart` de nove fatias | Barra ordenada lê melhor e não sugere severidade |

---

## B · Corrigido (a proposta se contradiz)

O design system declara que "cor de dado e cor de interface são conjuntos
disjuntos" — e a própria paleta viola a regra em três pontos. Medi a distância
euclidiana em RGB entre todos os pares; abaixo de 60 considerei colisão.

| Colisão medida | Distância | Correção |
|---|---|---|
| `cat-moto #A9503F` × `risk-5 #9E3E24` | **34** | Paleta categórica inteira recalculada fora da matiz da rampa |
| `alert #B23C22` × `risk-5 #9E3E24` | **20** | `--alert` movido para `#AB2F3F` + regra "dado preenche, interface traça" |
| `cat-ciclista #4B62A8` × `brand #2F5C93` | **36** | Categórico rotacionado; nova menor distância do conjunto: **57** |

Além disso:

**B-1 · A regra "conjuntos disjuntos" foi substituída por "dado preenche,
interface traça".** Disjunção de conjuntos é difícil de manter e quebra sozinha
quando a paleta cresce. Separação por *papel* — preenchimento contra traço — é
verificável em revisão de código e não impõe nenhuma restrição de matiz. É a
única mudança conceitual que fiz na proposta, e é o que sustenta o resto.

**B-2 · "Outros / não especificado" passou a cinza.** Na Bahia essa categoria
tem 8.842 registros: é a segunda maior. Uma cor confiante afirma um
conhecimento que não existe. Em cinza ela diz o que é.

**B-3 · Faltava regra de rótulo sobre a rampa.** Definida: tinta até `risk-3`,
canvas de `risk-4` em diante (`risk-5` contra tinta dá 2,3:1 e reprova).

**B-4 · `--attention` (3,6:1) reprovava em AA como texto.** Criado
`--attention-ink` (7,6:1) para quando o mesmo estado precisa virar texto.

**B-5 · Exportação em tema escuro não estava proibida.** Agora está: figura
exportada renderiza sempre em tema claro.

**B-6 · Faltava tratamento visual para dado preliminar.** Adicionado
(`--hatch-prelim`, régua de início do período, rótulo de cobertura parcial,
exclusão por padrão nos filtros) — relevante porque os dados de 2025 já foram
ingeridos e cobrem efetivamente três estados.

---

## C · Reduzido de escopo (bom, mas grande demais agora)

**C-1 · Migração para MapLibre GL + deck.gl → cortada.**
É a maior peça de trabalho da proposta e a de pior relação custo-benefício
neste momento: uma reescrita da camada de mapa para ganhar estilização por
expressão. O que realmente corrige a leitura — **classes fixas em vez de rampa
relativa ao recorte** — é independente de biblioteca e cabe em poucas linhas na
lib atual. Faça a correção; adie a migração.

**C-2 · Motor de leitura: 10 regras → 3 regras + 2 guardas.**
As dez regras com teste por regra são um projeto próprio. Três regras (`R1`
tendência, `R2` concentração, `R3` divergência) já cobrem as telas principais,
e as duas guardas (`G1` n insuficiente, `G2` evento único) são o que dá
credibilidade ao sistema numa banca. **`G2` é o caso Gavião** — a contribuição
metodológica do próprio trabalho vira comportamento do software. Se algo desta
seção não couber no tempo, corte `R3` antes das guardas.

**C-3 · Reestruturação de rotas → só renomear rótulos.**
Fundir `/temporal` com `/previsao` e transformar `/municipio` em painel de
detalhe são boas decisões de produto, mas quebram links e as capturas do
sistema já inseridas no artigo (Figuras 1 e 2). O ganho é organizacional; o
risco, na semana de entrega, não compensa. Rótulos novos no menu custam nada e
entregam a maior parte da clareza.

**C-4 · Exportação GeoJSON → fora.** PNG e CSV cobrem o uso real.

**C-5 · Teste de contrato "falha o *build* se houver hexadecimal fora de
`lib/theme/`" → última fase, opcional.** É uma boa trava, mas trava depois de
existir o que travar.

---

## D · Cortado

**D-1 · IBM Plex Serif (terceira família).**
Custa ~90 KB para produzir uma "voz de relatório" que contraste de tamanho e
peso já produz, e serifa misturada a sans reduz a velocidade de varredura numa
tela densa. Duas famílias — Sans e Mono. *Decisão reversível: reativar é uma
linha no carregamento da fonte.*

**D-2 · Manual de marca** (símbolo, área de reserva, versões proibidas,
regras de aplicação do *wordmark*). Um lockup simples no topo do menu resolve;
o resto é entregável de identidade visual, não de sistema de vigilância.

**D-3 · A tela "Painel Redesenhado v1"** (`referencia/03`) foi descartada em
favor da v2, que já incorpora a barra de recorte e a separação de camadas de
texto. Mantida na pasta apenas como histórico.

---

## E · Risco a observar

O artigo já contém **duas capturas do sistema (Figuras 1 e 2)**. Aplicar o
design system torna essas figuras desatualizadas. Duas saídas, ambas legítimas:

1. **Aplicar agora e recapturar** — fases 0 a 2 são suficientes para a
   aparência mudar; recapturar as duas figuras leva minutos.
2. **Aplicar depois da entrega** — o artigo fica coerente com o sistema como
   ele está hoje, e o redesign entra como trabalho futuro na seção de
   conclusões.

Não existe caminho em que as figuras atuais sobrevivam ao redesign. Decida
antes de rodar a fase 1, não depois.
