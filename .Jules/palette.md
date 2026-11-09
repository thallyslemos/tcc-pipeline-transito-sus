## 2024-05-20 - Add ARIA label and hover state to mobile menu button
**Learning:** Found an icon-only button without an ARIA label (`AppShell.tsx` menu button). Added accessibility attributes (`aria-label`, `aria-expanded`, `type="button"`) and a visual hover state using existing design tokens (`var(--sunken)`).
**Action:** Always check icon-only buttons for missing ARIA labels and hover states, and ensure they communicate their state (like `aria-expanded`) to screen readers.

## 2024-05-20 - Map Scale Toggle Button Pattern
**Learning:** Avoid using inline styles for `backgroundColor` on state toggle buttons, as this overrides Tailwind's pseudo-class utilities (like `hover:bg-[var(--sunken)]`). Toggle buttons also must explicitly convey their active state to screen readers.
**Action:** Use Tailwind's arbitrary values (e.g. `bg-[var(--surface)]`) instead of inline styles for dynamic backgrounds. Always include `aria-pressed={isActive}` and keyboard focus utilities (`outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]`).
