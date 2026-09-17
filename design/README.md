# design/ — Design System V01–V89 v2.1

Pacote de design do sistema de vigilância de mortalidade viária.
Origem: quatro *artboards* gerados no Claude Design, revisados e enxugados.

## O que ler, e em que ordem

| Arquivo | Para quê |
|---|---|
| `design-system.html` | **Comece aqui.** Referência visual navegável — paleta, tipografia, componentes, antes/depois. Abre no navegador, funciona offline, tem alternador de tema claro/escuro. |
| `DESIGN_SYSTEM.md` | A especificação implementável. É o documento que o agente de código deve seguir. |
| `tokens.css` | Fonte única de verdade de cor, tipografia e geometria. Copiar para o projeto. |
| `DECISOES.md` | O que foi mantido, corrigido e cortado da proposta original, com o porquê de cada decisão. |
| `validar_paleta.py` | Reproduz os números da paleta: converte OKLCH em sRGB, mede contraste WCAG e a distância entre tokens. `python3 validar_paleta.py`. |

## Sobre a proposta original

Os quatro *artboards* gerados no Claude Design (`Design System`,
`Sistema Atual`, `Painel Redesenhado`, `Painel Redesenhado v2`) continuam no
Claude Design e não foram copiados para cá: dependem de um runtime próprio e de
conexão para carregar. `design-system.html` é autossuficiente, abre offline e
mostra a versão que vale.

## Para o agente de código

O prompt de implementação está em `../PROMPT_DESIGN_SYSTEM.md`, com as fases,
os critérios de aceite e as travas de segurança. Não comece pelo código: leia
`DESIGN_SYSTEM.md` inteiro primeiro.
