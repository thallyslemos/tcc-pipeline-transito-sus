## 2024-10-01 - Consistent Focus and Hover States on Secondary Controls
**Learning:** Many secondary buttons and interactive elements in the application (such as pagination, clear filters, and theme toggles) lacked visible focus states for keyboard navigation and hover states for mouse interaction, leading to an inconsistent and less accessible experience. Keyboard users could not see which element had focus.
**Action:** Always apply `hover:bg-[var(--sunken)]` and `focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:outline-none` to secondary interactive elements to ensure consistent visual feedback and keyboard accessibility.
## 2024-10-25 - Search and Chat Input Accessibility

**Learning:** Screen readers and assistive technologies require implicit explicit label association or an explicit `aria-label` attribute on textual input fields like `search` and `text` to ensure context is conveyed to users when focusing on these fields. If an input field doesn't have an explicitly associated `<label>` tag using `htmlFor` matching the input's `id`, or an `aria-label` attribute when visual labels are omitted, it is functionally invisible or unhelpful to screen reader users.
**Action:** Always verify that every `<input>` field has either a linked label via `htmlFor` and `id`, or an explicit `aria-label` attribute to provide context.
