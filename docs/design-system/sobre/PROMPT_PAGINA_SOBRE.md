# Prompt para o Claude CLI (WSL) — página "Sobre o projeto"

> Cole no Claude CLI, na raiz do repositório, o bloco entre as linhas `====`.
> Pode ser feito em paralelo com as fases do `PROMPT_AJUSTES_DESIGN.md` — não
> toca em nenhum arquivo que aquelas fases alteram.

---

```
====================================================================

# TAREFA

Criar a rota `/sobre` — a página institucional do projeto, com a história, o
diagrama de arquitetura, o bloco do autor e as competências.

## Passo 0 — caminhos (você está no WSL, os arquivos vieram do Windows)

    Windows :  C:\Users\thall\OneDrive\Documentos\IFBA\TCC1\TCC\sobre
    WSL     :  /mnt/c/Users/thall/OneDrive/Documentos/IFBA/TCC1/TCC/sobre

Confirme que enxerga a pasta:

    ls -la "/mnt/c/Users/thall/OneDrive/Documentos/IFBA/TCC1/TCC/sobre"

Deve listar `sobre-mockup.html`, `ESPEC_PAGINA_SOBRE.md` e este prompt.

Se falhar: `/mnt/c` ausente → veja `cat /etc/wsl.conf` e `wslpath -u`. Se listar
mas a leitura devolver `Input/output error`, é o OneDrive com "Arquivos sob
Demanda" — peça ao usuário para marcar a pasta como "Sempre manter neste
dispositivo".

Copie para dentro do repositório antes de trabalhar:

    mkdir -p docs/design-system/sobre
    cp -r "/mnt/c/Users/thall/OneDrive/Documentos/IFBA/TCC1/TCC/sobre/." docs/design-system/sobre/

## Passo 1 — leia antes de codar

1. `docs/design-system/sobre/ESPEC_PAGINA_SOBRE.md` — o conteúdo e as decisões.
2. `docs/design-system/sobre/sobre-mockup.html` — **abra no navegador**. É a
   referência visual e contém o SVG do diagrama pronto para copiar.
3. `docs/design-system/DESIGN_SYSTEM.md` — a autoridade de estilo.

Branch `feat/pagina-sobre`. Commits pequenos. Build e lint ao fim.

# O QUE CONSTRUIR

## 1 · Rota e navegação

- Nova rota `/sobre`, renderizada com os mesmos componentes de casca das demais
  telas (menu lateral, área de conteúdo).
- Item **"Sobre o projeto"** no fim do grupo **MÉTODO** do menu.
- **Esta tela não tem `<BarraDeRecorte>`** — não há recorte. Não coloque chips,
  `N =` nem "link do recorte".
- Título da aba do navegador: `Sobre o projeto · Trânsito no SUS`.

## 2 · Conteúdo

Transponha as seis seções do mockup, na ordem. O texto do mockup é definitivo —
copie literalmente, não reescreva:

1. Cabeçalho com lede editorial e a nota sobre texto editorial
2. `01 · De onde veio` — três cartões de origem
3. `02 · Trajetória` — linha do tempo de quatro marcos
4. `03 · Como funciona` — diagrama + cinco indicadores
5. `04 · Autor` — duas colunas
6. `05 · Competências` — seis blocos com etiquetas
7. `06 · Créditos e transparência`

Coloque os textos longos em `src/content/sobre.ts`, não soltos no JSX — mesma
regra das outras telas.

## 3 · O diagrama

Copie o `<svg viewBox="0 0 1080 300">` do mockup para um componente próprio,
`<DiagramaFluxo />`.

- **Não instale Mermaid.** O SVG usa `var(--risk-1)`, `var(--brand)`,
  `var(--hairline)` etc. e acompanha o tema sozinho; Mermaid não faria isso e
  custaria centenas de KB por uma figura estática.
- Largura fluida (`width:100%; height:auto`), `role="img"` e o `aria-label`
  descritivo que já está no mockup.
- Em telas estreitas o SVG encolhe; abaixo de 720px de viewport, deixe-o rolar
  dentro de um contêiner com `overflow-x:auto` em vez de espremer.

## 4 · Indicadores ao vivo

Cinco blocos abaixo do diagrama. Busque no carregamento:

- `GET /api/sim/metadata` → contagem de `datasets`, linhas do dataset
  `sim_silver_nacional_v2`, `catalog_version` e `generated_at`
- `GET /api/sim/summary` → `periodo`

**Todo indicador tem valor de fallback fixo no código.** Se a requisição
falhar, mostre o fallback silenciosamente — a página não pode quebrar numa
demonstração. Fallbacks: 20.410.620 linhas · 10 datasets · 2010–2024 · V01–V89 ·
99,958%.

Formatação pt-BR pelos mesmos helpers das outras telas.

`catalog_version` e `generated_at` vão para o rodapé de proveniência da página.

## 5 · Campos ainda não fornecidos

O mockup marca com etiqueta âmbar sete campos que o usuário ainda vai passar:
URLs de LinkedIn/GitHub/Lattes, períodos das três etapas profissionais, cargo
atual, nome do programa de residência, significado da sigla SASI, foto e
licença.

Modele todos em `src/content/sobre.ts` como campos opcionais e **omita o
elemento quando o valor estiver vazio** — nada de placeholder visível em
produção. A foto, quando ausente, cai para as iniciais em monoespaçada dentro
do mesmo círculo.

Deixe no topo de `sobre.ts` um comentário listando exatamente o que falta
preencher, para o usuário completar em um só lugar.

## 6 · Regras de estilo

- **Nenhuma cor de dado fora do diagrama.** Esta página não codifica valor: use
  neutros e `--brand`. Dentro do diagrama, `--risk-1/2/5` nomeiam as camadas.
- Régua de 1px, raio 6 em cartão e 4 em controle, sem sombra.
- Rótulos de seção e números em mono; texto em sans; largura de texto ≤ 80ch.
- Foto e links são interface: traço e texto, nunca preenchimento colorido.
- Rodapé de proveniência presente, com a ressalva de que a página é editorial.

## 7 · Acessibilidade

- Um `<h1>` só, hierarquia de títulos sem pulos.
- `aria-label` no SVG (já no mockup) e nos links externos
  (`aria-label="LinkedIn de Thallys Viana Lemos (abre em nova aba)"`).
- Links externos com `target="_blank" rel="noopener noreferrer"`.
- Foco visível em todos os links.
- Contraste AA: o texto pequeno usa `--ink-2`, nunca `--ink-3`.

## 8 · Responsivo

- ≥ 1100px: grades de 3 e de 2 colunas como no mockup.
- 720–1100px: origens e competências em 2 colunas; linha do tempo em 2 colunas.
- < 720px: tudo em coluna única; a linha do tempo vira vertical, com a régua
  ligando os pontos pela esquerda.

# ACEITE

1. `/sobre` abre pelo menu, em claro e escuro, sem rolagem horizontal.
2. O diagrama muda de cor com o tema, sem recarregar.
3. Com a API desligada, a página carrega inteira e mostra os fallbacks.
4. Nenhum campo não preenchido aparece na tela.
5. `grep` de hexadecimal na rota nova não retorna nada.
6. Nenhum `<BarraDeRecorte>` na página.

Ao terminar, diga o que ficou pendente e liste os campos de `sobre.ts` que o
usuário precisa preencher. Não abra pull request.

====================================================================
```
