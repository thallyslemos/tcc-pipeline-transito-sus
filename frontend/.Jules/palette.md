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
