# Architecture

PCB Reverse Tracer is a browser app (Vite + React + TypeScript). Rendering uses WebGL via PixiJS behind a
`Renderer` interface. The rules behind this document are in [CLAUDE.md](../CLAUDE.md); the stack decision
is [ADR 0001](adr/0001-stack.md), coordinates are in [ADR 0002](adr/0002-coordinates-and-transforms.md)
and photo display in [ADR 0003](adr/0003-image-display.md).

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
| `src/core/` | Pure domain logic: geometry, model, alignment, view, commands (later connectivity, footprints, io). No DOM, React, PixiJS or browser APIs. | nothing outside `core` | M0 |
| `src/tools/` | Editor interaction state machines: pan/zoom navigation (M1), one file per editing `Tool` (M3). | `core` | M1 |
| `src/render/` | `buildScene` (state → what to draw), the `Renderer` interface and its PixiJS implementation. Reads state, never mutates it. | `core`, `tools` | M1 |
| `src/ui/` | React components and the Zustand editor store. Thin: dispatch commands, show state, turn DOM events into tool inputs. | `core`, `tools` | M0 |
| `src/platform/` | File access and image decoding (later storage, clipboard); browser vs desktop adapters. | `core` | M1 |
| `src/app/` | Composition root: creates the store, image registry and renderer and wires them together. Nothing imports it. | everything | M0 |

## Data flow (M1)

```
file input ─► app/importPhoto ─► platform/imageLoader (decode + tile) ─► app/imageRegistry (pixels)
                   │
                   └─► store.dispatch(setLayerImage) ─► project (metadata only)

pointer / wheel / keys ─► ui (DOM events) ─► tools/navigation ─► store.updateView(viewport)

store change ─► app/boardController (at most once per frame) ─► render/buildScene ─► Renderer.render
```

- **Project** (`core/model`): what will be saved — layers, photo metadata, mirror flag. Changed only by
  commands (`core/commands`).
- **View state** (`core/view`): active layer, viewport, overlay opacity, hidden photos. Looking at the
  board is not an edit, so view changes are not commands and are not saved with the project.
- **Pixels**: decoded photo tiles live in the app's image registry, keyed by image id, outside the model.

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

- **All model mutations go through commands** (`execute`; `undo` arrives with the history in M3); UI and
  tools never mutate the project directly.
- The persisted model is plain, serializable data. **Derived data (nets, net colors) is never stored.**
- Internal units are millimetres in board space. Image pixels exist only inside `core/alignment`.
- Expected failures at boundaries return `Result<T, E>` (`src/core/result.ts`); core never throws for them.
- Extensible things (tools, feature kinds, footprints, exporters, shortcuts) are **registered** in lookup
  tables, not added to `switch` statements.

## Tests

| Kind | Where | Environment |
| --- | --- | --- |
| Unit (core, tools, scripts) | next to the code, `*.test.ts` | Vitest, node |
| Unit (ui, render, platform, app) | next to the code, `*.test.ts(x)` | Vitest, jsdom |
| Shared test helpers | `*.test-support.ts` (e.g. fast-check generators) | treated as test code by every tool |
| E2E | `e2e/*.spec.ts`; reads rendered WebGL pixels to check overlay and mirroring | Playwright, Chromium, production build |

Property tests use a fixed fast-check seed (`vitest.setup.ts`); run `FC_SEED=<n> pnpm test` to explore
other cases. Files that need a real browser (`src/render/pixi/**`, `src/platform/browserImage.ts`,
`src/app/main.tsx`) are excluded from unit coverage and covered by the e2e tests.

## Tooling layout

| File | Purpose |
| --- | --- |
| `tsconfig.base.json` | Shared strict compiler options |
| `tsconfig.core.json` / `tsconfig.app.json` / `tsconfig.node.json` / `tsconfig.e2e.json` | Core without DOM / browser app / config files and scripts / Playwright specs |
| `eslint.config.js` | Flat config, type-checked rules + quality limits |
| `.dependency-cruiser.cjs` | Layer boundaries |
| `vitest.config.ts` / `vitest.setup.ts` | Test projects (node, jsdom), coverage thresholds and excludes, fast-check seed |
| `playwright.config.ts` | E2E against `vite preview` |
| `scripts/crap.ts` | CRAP check |
| `.github/workflows/ci.yml` | CI pipeline |
