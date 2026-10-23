## 2024-05-24 - Inline CSS and Tailwind Pseudo-classes Conflict
**Learning:** Avoid using inline styles for dynamic backgrounds on interactive elements (e.g., `style={{ backgroundColor: 'var(--surface)' }}`) as they override Tailwind's pseudo-class utilities like `hover:` due to CSS specificity rules.
**Action:** Use Tailwind's arbitrary values (e.g., `bg-[var(--surface)]`) instead to ensure hover states and other pseudo-classes function correctly.
## 2024-10-01 - Explicit Mobile Close Buttons and Focus Styling
**Learning:** Overlays designed purely for "click-outside to close" create an accessibility issue for mobile/small viewports where the overlay consumes the whole screen. A visible `aria-hidden` attribute on the overlay empty div prevents confusing screen reader output, and an explicit, focusable close button must be present in the modal/sidebar itself.
**Action:** When creating off-canvas elements or overlays, always provide an explicit close action within the panel and add `aria-hidden="true"` to pure-backdrop decorative `div`s. Also, consistently use `outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]` on all interactive elements to ensure visual keyboard navigability.

## 2024-10-01 - Explicit Mobile Close Buttons and Focus Styling
**Learning:** Overlays designed purely for "click-outside to close" create an accessibility issue for mobile/small viewports where the overlay consumes the whole screen. A visible `aria-hidden` attribute on the overlay empty div prevents confusing screen reader output, and an explicit, focusable close button must be present in the modal/sidebar itself.
**Action:** When creating off-canvas elements or overlays, always provide an explicit close action within the panel and add `aria-hidden="true"` to pure-backdrop decorative `div`s. Also, consistently use `outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]` on all interactive elements to ensure visual keyboard navigability.

## 2026-10-23 - Clipboard Feedback and Keyboard Focus Accessibility
**Learning:** Interactive bare text buttons like "Link do recorte" and "Exportar" frequently lack keyboard focus indicators and provide no visual/auditory feedback upon interaction. Users leveraging copy-to-clipboard functionality need immediate confirmation of success, especially screen reader users.
**Action:** Add temporary visual state changes (e.g., "Copiado!") coupled with `aria-live="polite"` for clipboard operations to provide immediate, accessible feedback. Ensure bare text buttons have explicit focus styling using standard design system utilities (e.g., `outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] rounded focus-visible:ring-offset-1`).
