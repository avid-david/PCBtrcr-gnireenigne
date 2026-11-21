# Architecture

PCB Reverse Tracer is a browser app (Vite + React + TypeScript). Rendering will use WebGL via PixiJS
behind a `Renderer` interface (from M1). The rules behind this document are in [CLAUDE.md](../CLAUDE.md);
the stack decision is [ADR 0001](adr/0001-stack.md).

## Layers

Dependencies point inward. Arrows mean "may import".

```
            app  (composition root — knows everything)
           / |  \
         ui render platform
          \  |     |
          tools    |
             \     |
              core ◄
```

| Folder | Contents | May import | Exists since |
| --- | --- | --- | --- |
| `src/core/` | Pure domain logic: geometry, model, connectivity, commands, footprints, io. No DOM, React, PixiJS or browser APIs. | nothing outside `core` | M0 (`result.ts`) |
| `src/tools/` | One file per editor tool; each a small state machine implementing `Tool`. | `core` | M3 |
| `src/render/` | Draws the model; reads state, never mutates it. | `core`, `tools` | M1 |
| `src/ui/` | React components. Thin: dispatch commands, show state. | `core`, `tools` | M0 (`AppShell`) |
| `src/platform/` | File access, storage, clipboard; browser vs desktop adapters. | `core` | M1 |
| `src/app/` | Composition root: wires everything together. Nothing imports it. | everything | M0 (`main.tsx`) |

Folders are created when the first milestone needs them; the boundary rules already cover them.

## How the rules are enforced

| Rule | Enforced by |
| --- | --- |
| Layer imports (table above), no circular imports, no undeclared or dev-only packages in production code | dependency-cruiser (`.dependency-cruiser.cjs`), part of `pnpm lint` |
| `core` uses no DOM or Node APIs | `tsconfig.core.json` compiles `src/core` with `lib: ["ES2023"]` and no ambient types |
| `core` imports no React / PixiJS / Zustand | dependency-cruiser rule `core-no-ui-or-render-libraries` |
| Complexity, nesting, function/file length, parameter count, no `any` / `!` / `@ts-ignore` | ESLint (`eslint.config.js`); inline disables are ignored and reported |
| Coverage ≥ 90 % for `src/core/**`, ≥ 75 % overall | Vitest coverage thresholds (`vitest.config.ts`) |
| CRAP < 30 per function (target < 15) | `scripts/crap.ts` (`pnpm crap`) |

## Key conventions

- **All model mutations go through commands** (`execute` / `undo`); UI and tools never mutate directly.
- The persisted model is plain, serializable data. **Derived data (nets, net colors) is never stored.**
- Internal units are millimetres in board space. Image pixels exist only inside alignment code.
- Expected failures at boundaries return `Result<T, E>` (`src/core/result.ts`); core never throws for them.
- Extensible things (tools, feature kinds, footprints, exporters) are **registered**, not added to
  `switch` statements.

## Tests

| Kind | Where | Environment |
| --- | --- | --- |
| Unit (core, tools, scripts) | next to the code, `*.test.ts` | Vitest, node |
| Unit (ui, render, platform) | next to the code, `*.test.tsx` | Vitest, jsdom |
| E2E smoke | `e2e/*.spec.ts` | Playwright, Chromium, production build |

## Tooling layout

| File | Purpose |
| --- | --- |
| `tsconfig.base.json` | Shared strict compiler options |
| `tsconfig.core.json` / `tsconfig.app.json` / `tsconfig.node.json` / `tsconfig.e2e.json` | Core without DOM / browser app / config files and scripts / Playwright specs |
| `eslint.config.js` | Flat config, type-checked rules + quality limits |
| `.dependency-cruiser.cjs` | Layer boundaries |
| `vitest.config.ts` | Test projects (node, jsdom) and coverage thresholds |
| `playwright.config.ts` | E2E against `vite preview` |
| `scripts/crap.ts` | CRAP check |
| `.github/workflows/ci.yml` | CI pipeline |
