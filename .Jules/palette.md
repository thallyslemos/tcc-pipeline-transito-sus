## 2024-05-20 - Add ARIA label and hover state to mobile menu button
**Learning:** Found an icon-only button without an ARIA label (`AppShell.tsx` menu button). Added accessibility attributes (`aria-label`, `aria-expanded`, `type="button"`) and a visual hover state using existing design tokens (`var(--sunken)`).
**Action:** Always check icon-only buttons for missing ARIA labels and hover states, and ensure they communicate their state (like `aria-expanded`) to screen readers.
