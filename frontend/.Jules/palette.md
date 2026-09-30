## 2025-02-28 - CSS Specificity Conflict with Tailwind Hover States
**Learning:** Using inline styles for dynamic background colors (e.g., `style={{ backgroundColor: active ? "var(--brand-soft)" : "transparent" }}`) in Next.js/React prevents Tailwind's `hover:` pseudo-classes from applying due to CSS specificity rules.
**Action:** Use Tailwind's arbitrary values (e.g., `bg-[var(--brand-soft)]`) directly in the `className` string to apply dynamic theme variables, ensuring `hover:` states function correctly.
