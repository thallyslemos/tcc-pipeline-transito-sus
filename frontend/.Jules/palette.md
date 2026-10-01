## 2025-02-20 - Fix hover states overridden by inline dynamic backgrounds
**Learning:** Using inline React styles for dynamic interaction states (e.g., `style={{ backgroundColor: active ? "var(--brand-soft)" : "transparent" }}`) overrides Tailwind pseudo-classes like `hover:bg-[var(--sunken)]` due to high CSS specificity. This breaks the interaction feedback loop.
**Action:** Replace dynamic inline background/color styles with conditional Tailwind arbitrary value classes (e.g., `className={active ? "bg-[var(--brand-soft)]" : "hover:bg-[var(--sunken)]"}`) to allow expected pseudo-class behavior while respecting the design system variables.

## 2024-10-25 - Search and Chat Input Accessibility

**Learning:** Screen readers and assistive technologies require implicit explicit label association or an explicit `aria-label` attribute on textual input fields like `search` and `text` to ensure context is conveyed to users when focusing on these fields. If an input field doesn't have an explicitly associated `<label>` tag using `htmlFor` matching the input's `id`, or an `aria-label` attribute when visual labels are omitted, it is functionally invisible or unhelpful to screen reader users.
**Action:** Always verify that every `<input>` field has either a linked label via `htmlFor` and `id`, or an explicit `aria-label` attribute to provide context.
