## 2024-10-25 - Search and Chat Input Accessibility

**Learning:** Screen readers and assistive technologies require implicit explicit label association or an explicit `aria-label` attribute on textual input fields like `search` and `text` to ensure context is conveyed to users when focusing on these fields. If an input field doesn't have an explicitly associated `<label>` tag using `htmlFor` matching the input's `id`, or an `aria-label` attribute when visual labels are omitted, it is functionally invisible or unhelpful to screen reader users.
**Action:** Always verify that every `<input>` field has either a linked label via `htmlFor` and `id`, or an explicit `aria-label` attribute to provide context.
