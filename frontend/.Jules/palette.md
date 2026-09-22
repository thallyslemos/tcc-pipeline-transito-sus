## 2024-05-24 - Inline Styles Override Tailwind Hover Utilities
**Learning:** Using inline `style={{ backgroundColor: 'var(--surface)' }}` for unselected states prevents Tailwind's `hover:bg-[var(--sunken)]` from working due to CSS specificity rules, resulting in buttons lacking hover feedback.
**Action:** Always use Tailwind's arbitrary values (e.g., `bg-[var(--surface)]`) instead of inline styles for dynamic backgrounds on interactive elements to ensure pseudo-classes like `hover:` function correctly.

## 2024-05-24 - Skip to Main Content Link
**Learning:** Keyboard users were forced to tab through the entire sidebar navigation before reaching the main content on every page load or route change.
**Action:** Implemented a visually hidden "Skip to main content" link at the top of the DOM that becomes visible on focus, greatly improving keyboard navigation efficiency.
