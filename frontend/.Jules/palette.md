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
