# Module Architecture Guidelines

To maintain clean, scalable, and testable code within the modules directory, all new feature modules must adhere to the following directory layout and design patterns.

## Directory Structure

Every module under `src/modules/` should follow this standardized structure:

```text
my-module/
├── components/          # Presentational & interactive sub-components
│   ├── MySubComponentA.tsx
│   └── MySubComponentB.tsx
├── hooks/               # Custom React hooks containing the business logic & state
│   └── useMyModule.ts
├── services/            # API fetchers, business calculation helpers
│   └── my-service.ts
├── types.ts             # Module-specific type & interface definitions
└── MyModuleMain.tsx     # Main entry point (shell orchestrator)
```

## Core Principles

1. **Decouple Logic from Presentation**:
   - The main orchestrator file (`MyModuleMain.tsx`) and sub-components should contain minimal inline state.
   - All state management, effects, and API requests must live inside a custom hook under `/hooks/`.

2. **Modular Components**:
   - Avoid bloated files. If a component exceeds 150–200 lines, extract its UI parts into `/components/`.
   - Keep components focused on rendering their slice of the UI.

3. **Centralized Types**:
   - Do not define local interfaces inside multiple files. Put all shared interfaces in a unified `types.ts` at the root of the module.

4. **Service Isolation**:
   - Move database fetches, API calls, and complex math equations to a file in `/services/` or the app-wide services directory to make them easily reusable and mockable.
