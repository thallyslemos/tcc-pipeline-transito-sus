## 2024-05-24 - Inline CSS and Tailwind Pseudo-classes Conflict
**Learning:** Avoid using inline styles for dynamic backgrounds on interactive elements (e.g., `style={{ backgroundColor: 'var(--surface)' }}`) as they override Tailwind's pseudo-class utilities like `hover:` due to CSS specificity rules.
**Action:** Use Tailwind's arbitrary values (e.g., `bg-[var(--surface)]`) instead to ensure hover states and other pseudo-classes function correctly.
## 2024-10-01 - Explicit Mobile Close Buttons and Focus Styling
**Learning:** Overlays designed purely for "click-outside to close" create an accessibility issue for mobile/small viewports where the overlay consumes the whole screen. A visible `aria-hidden` attribute on the overlay empty div prevents confusing screen reader output, and an explicit, focusable close button must be present in the modal/sidebar itself.
**Action:** When creating off-canvas elements or overlays, always provide an explicit close action within the panel and add `aria-hidden="true"` to pure-backdrop decorative `div`s. Also, consistently use `outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]` on all interactive elements to ensure visual keyboard navigability.

## 2024-10-01 - Explicit Mobile Close Buttons and Focus Styling
**Learning:** Overlays designed purely for "click-outside to close" create an accessibility issue for mobile/small viewports where the overlay consumes the whole screen. A visible `aria-hidden` attribute on the overlay empty div prevents confusing screen reader output, and an explicit, focusable close button must be present in the modal/sidebar itself.
**Action:** When creating off-canvas elements or overlays, always provide an explicit close action within the panel and add `aria-hidden="true"` to pure-backdrop decorative `div`s. Also, consistently use `outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]` on all interactive elements to ensure visual keyboard navigability.


## 2025-02-28 - CSS Specificity Conflict with Tailwind Hover States
**Learning:** Using inline styles for dynamic background colors (e.g., `style={{ backgroundColor: active ? "var(--brand-soft)" : "transparent" }}`) in Next.js/React prevents Tailwind's `hover:` pseudo-classes from applying due to CSS specificity rules.
**Action:** Use Tailwind's arbitrary values (e.g., `bg-[var(--brand-soft)]`) directly in the `className` string to apply dynamic theme variables, ensuring `hover:` states function correctly.


## 2024-10-02 - Inline Background Styles Break Tailwind Hover Specificity
**Learning:** Using inline styles for dynamic background colors on interactive elements (e.g., `style={{ backgroundColor: 'var(--surface)' }}`) prevents Tailwind's pseudo-class utilities like `hover:bg-[var(--sunken)]` from working due to CSS specificity rules. Inline styles always win.
**Action:** When building toggleable or interactive elements that need conditional background colors, use Tailwind arbitrary values in the `className` string (e.g., `className={`... ${isActive ? "bg-[var(--brand-soft)]" : "bg-[var(--surface)]"}`}`) instead of inline `style={{}}`. This preserves the ability for `hover:` and `focus-visible:` classes to override the background appropriately.


## 2025-02-24 - Skip to Main Content Link Styling
**Learning:** When implementing "skip to main content" links (which are essential for keyboard navigation past sidebars), the visually hidden state should be managed by translating the element off-screen using `absolute -translate-y-full`. When focused via keyboard, it should animate into view using `focus-visible:translate-y-0`. This avoids layout shift and provides a smooth experience. Additionally, the target content container should receive `id="main-content"`, `tabIndex={-1}`, and `outline-none` to allow programmatic focus without displaying an unsightly focus ring.
**Action:** Consistently use the `-translate-y-full` to `focus-visible:translate-y-0` pattern for skip links. Ensure target containers use `tabIndex={-1}` and `outline-none` for seamless programmatic focus management.


## 2024-05-18 - Acessibilidade em Botões de Alternância no Mapa
**Learning:** Botões que alternam modos visuais (como de Polígonos para Círculos num mapa) precisam de indicações claras de estado para tecnologias assistivas, além de apenas rótulos. O uso combinado de `aria-pressed` e `aria-label` é essencial.
**Action:** Sempre verificar e adicionar `aria-pressed={condicao}` em botões que atuam como toggles de estado visual, e focar o contorno visual com utilitários `focus-visible` do Tailwind para garantir a navegação por teclado.


## 2024-10-08 - Accessible Map Mode Toggles
**Learning:** Toggle buttons (like map mode switchers) without `aria-pressed` or keyboard focus styles block screen reader users from understanding their state and keyboard users from navigating to them.
**Action:** When implementing toggle buttons, always add an `aria-pressed` attribute matching the component state and explicit focus utilities like `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]`.


## 2024-10-02 - State Toggle Buttons and ARIA Pressed
**Learning:** State toggle buttons without `aria-pressed` attributes are read as regular buttons by screen readers, failing to communicate which sorting/filtering mode is currently active.
**Action:** Always include `aria-pressed={activeState === "currentMode"}` on state toggle buttons to clearly convey active status to assistive technologies.


## 2024-10-10 - Keyboard accessibility utilities and aria-pressed states
**Learning:** For keyboard accessibility, interactive elements (like buttons) must have a visual focus indicator. The standard pattern across this application is to use Tailwind utilities `outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]`. Text links / bare buttons might also need `rounded` and `focus-visible:ring-offset-1` so the outline looks balanced. State toggle buttons (like "Polígonos" / "Círculos") must include an `aria-pressed={boolean}` attribute to convey their active state clearly to screen readers.
**Action:** Ensure all new buttons and interactive elements include these focus visibility utilities. Use `aria-pressed` for any button that acts as a state toggle.


## 2026-10-10 - Focus States for Accessibility
**Learning:** Interactive elements like buttons need visible focus states to support keyboard navigation.
**Action:** Apply the standard Tailwind classes `outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-1` to all custom button implementations.


## 2026-10-11 - Immediate feedback for copy actions
**Learning:** Interactive actions like copying to clipboard need immediate visual and screen reader feedback (using `aria-live`), otherwise users are left uncertain if the action succeeded.
**Action:** When implementing copy-to-clipboard functionality, always include a temporary visual state change (e.g., 'Copiado!') and an `aria-live="polite"` attribute to announce the success to screen readers.


## 2024-10-13 - Visual feedback for copy to clipboard action
**Learning:** Users lack immediate visual feedback when interacting with copy-to-clipboard elements, which reduces certainty that the action succeeded. When modifying button text directly for temporary feedback (e.g. "Copiado!"), it's crucial to also include `aria-live="polite"` so screen reader users are also informed of the state change.
**Action:** Add temporary visual state changes (like swapping text to "Copiado!") alongside `aria-live="polite"` on copy-to-clipboard interactions across the application to improve certainty for all users.


## 2026-10-16 - Feedback completo para operações de área de transferência
**Learning:** Operações de cópia para a área de transferência precisam tanto de feedback visual temporário (ex: texto mudando para 'Copiado!') quanto de feedback para leitores de tela usando `aria-live="polite"` para garantir uma experiência acessível e completa.
**Action:** Ao implementar botões de 'copiar link' ou funcionalidades semelhantes, sempre gerenciar um estado temporário de sucesso e aplicar `aria-live="polite"` para anúncios dinâmicos.


## 2024-10-21 - Visual and Screen Reader Feedback for Copy Actions
**Learning:** Copy-to-clipboard buttons (like "Link do recorte") lack inherent feedback, leaving users (especially screen reader users) unsure if the action succeeded.
**Action:** When implementing copy-to-clipboard functionality, always include a temporary visual state change (e.g., text changing to "Copiado!") and ensure the button has `aria-live="polite"` so screen readers announce the text change immediately.


## 2024-10-23 - Visual confirmation for "Copiar Link" actions
**Learning:** Actions that interact with the clipboard (like copying a URL) often lacked immediate visual and screen reader feedback in this app. Users clicking "Link do recorte" wouldn't know if the action succeeded.
**Action:** Adding a temporary "Copiado!" visual state with `aria-live="polite"` to clipboard actions provides both visual confirmation and screen reader announcement, adhering to accessibility best practices.


## 2026-10-23 - Clipboard Feedback and Keyboard Focus Accessibility
**Learning:** Interactive bare text buttons like "Link do recorte" and "Exportar" frequently lack keyboard focus indicators and provide no visual/auditory feedback upon interaction. Users leveraging copy-to-clipboard functionality need immediate confirmation of success, especially screen reader users.
**Action:** Add temporary visual state changes (e.g., "Copiado!") coupled with `aria-live="polite"` for clipboard operations to provide immediate, accessible feedback. Ensure bare text buttons have explicit focus styling using standard design system utilities (e.g., `outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] rounded focus-visible:ring-offset-1`).


## 2025-10-31 - Feedback visual para acao de copia (Clipboard)
**Learning:** Copiar um link para o clipboard altera um estado externo (a area de transferencia do SO) sem nenhum impacto natural na UI. Se nao houver feedback visual (como o texto do botao mudar para "Copiado!" temporariamente) e sonoro (atraves de `aria-live="polite"` alertando leitores de tela), o usuario fica em duvida se a acao funcionou e pode clicar multiplas vezes ou abandonar a tarefa.
**Action:** Ao criar componentes que copiam dados para a area de transferencia, sempre inclua um estado local (ex: `copiado`) ativado no `onClick` e revertido apos ~2s (via `setTimeout`). O texto do botao deve refletir o estado de sucesso e deve conter `aria-live="polite"` para suportar a11y.


## 2024-10-26 - Accessible Clipboard Copy Feedback
**Learning:** Copying links or data to the clipboard without visual and screen reader feedback leaves users unsure if the action succeeded.
**Action:** When implementing copy-to-clipboard functionality, always include a temporary visual state change (e.g., 'Copiado!') and an `aria-live="polite"` attribute to provide immediate feedback and announce the success to screen readers.

## 2026-10-31 - CSS Specificity Conflict with Tailwind Hover States
**Learning:** Using inline styles for dynamic background colors (e.g., `style={{ backgroundColor: active ? "var(--brand-soft)" : "transparent" }}`) in Next.js/React prevents Tailwind's `hover:` pseudo-classes from applying due to CSS specificity rules.
**Action:** Use Tailwind's arbitrary values (e.g., `bg-[var(--brand-soft)]`) directly in the `className` string to apply dynamic theme variables, ensuring `hover:` states function correctly. Also, remember to add `aria-pressed` and `focus-visible` styles to toggle buttons for better accessibility.
