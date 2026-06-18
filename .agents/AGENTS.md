# Project Rules & Constraints

## ESLint & Workspace Hygiene
- **Do NOT modify `eslint.config.mjs`**: Custom rule overrides, disabling of typescript-eslint rules, or changing react warnings globally is strictly forbidden. Keep the configuration in its original base state.
- **Do NOT touch `src/components/ui/`**: No additions, modifications, or deletions of files inside the global components directory (`src/components/ui/`) are allowed in any PR.
