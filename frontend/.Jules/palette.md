## 2024-05-24 - Inline CSS and Tailwind Pseudo-classes Conflict
**Learning:** Avoid using inline styles for dynamic backgrounds on interactive elements (e.g., `style={{ backgroundColor: 'var(--surface)' }}`) as they override Tailwind's pseudo-class utilities like `hover:` due to CSS specificity rules.
**Action:** Use Tailwind's arbitrary values (e.g., `bg-[var(--surface)]`) instead to ensure hover states and other pseudo-classes function correctly.
## 2024-10-01 - Explicit Mobile Close Buttons and Focus Styling
**Learning:** Overlays designed purely for "click-outside to close" create an accessibility issue for mobile/small viewports where the overlay consumes the whole screen. A visible `aria-hidden` attribute on the overlay empty div prevents confusing screen reader output, and an explicit, focusable close button must be present in the modal/sidebar itself.
**Action:** When creating off-canvas elements or overlays, always provide an explicit close action within the panel and add `aria-hidden="true"` to pure-backdrop decorative `div`s. Also, consistently use `outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]` on all interactive elements to ensure visual keyboard navigability.

## 2024-10-01 - Explicit Mobile Close Buttons and Focus Styling
**Learning:** Overlays designed purely for "click-outside to close" create an accessibility issue for mobile/small viewports where the overlay consumes the whole screen. A visible `aria-hidden` attribute on the overlay empty div prevents confusing screen reader output, and an explicit, focusable close button must be present in the modal/sidebar itself.
**Action:** When creating off-canvas elements or overlays, always provide an explicit close action within the panel and add `aria-hidden="true"` to pure-backdrop decorative `div`s. Also, consistently use `outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]` on all interactive elements to ensure visual keyboard navigability.

## 2025-10-31 - Feedback visual para acao de copia (Clipboard)
**Learning:** Copiar um link para o clipboard altera um estado externo (a area de transferencia do SO) sem nenhum impacto natural na UI. Se nao houver feedback visual (como o texto do botao mudar para "Copiado!" temporariamente) e sonoro (atraves de `aria-live="polite"` alertando leitores de tela), o usuario fica em duvida se a acao funcionou e pode clicar multiplas vezes ou abandonar a tarefa.
**Action:** Ao criar componentes que copiam dados para a area de transferencia, sempre inclua um estado local (ex: `copiado`) ativado no `onClick` e revertido apos ~2s (via `setTimeout`). O texto do botao deve refletir o estado de sucesso e deve conter `aria-live="polite"` para suportar a11y.
