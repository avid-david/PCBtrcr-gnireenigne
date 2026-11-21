# Architecture

PCB Reverse Tracer is a browser app (Vite + React + TypeScript). Rendering uses WebGL via PixiJS behind a
`Renderer` interface. The rules behind this document are in [CLAUDE.md](../CLAUDE.md); the stack decision
is [ADR 0001](adr/0001-stack.md), coordinates are in [ADR 0002](adr/0002-coordinates-and-transforms.md),
photo display in [ADR 0003](adr/0003-image-display.md), alignment in [ADR 0004](adr/0004-alignment.md)
features, connectivity, undo and tools in [ADR 0005](adr/0005-features-connectivity-undo.md), and
the project file and autosave in [ADR 0006](adr/0006-project-file-and-autosave.md), and
footprints, components, planes, text and silkscreen in [ADR 0007](adr/0007-footprints-components-planes.md).

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
| `src/core/` | Pure domain logic: geometry, model (incl. copper features), alignment, connectivity, view, commands and undo history, io (project file format, versions, migrations, zip archive), footprints (JSON parts and parametric families). No DOM, React, PixiJS or browser APIs. | nothing outside `core` | M0 |
| `src/tools/` | Interaction state machines: pan/zoom navigation, and the registered editing tools (select, trace, via, pad, point, hole, component, plane, silkscreen, text, align) with snapping. They return commands, never mutate. | `core` | M1 |
| `src/render/` | `buildScene` (state → what to draw, incl. outline and alignment markers), the `Renderer` interface and its PixiJS implementation. Reads state, never mutates it. | `core`, `tools` (not `ui`) | M1 |
| `src/ui/` | React components and the Zustand editor store. Thin: dispatch commands, show state, turn DOM events into tool inputs. | `core`, `tools` (not `render`) | M0 |
| `src/platform/` | Image decoding, file download, key-value storage (IndexedDB) for autosave (later clipboard); browser vs desktop adapters. | `core` | M1 |
| `src/app/` | Composition root: creates the store, image registry and renderer and wires them together; open/save (`projectFiles`), autosave and recovery (`autosave`, `persistence`). Nothing imports it. | everything | M0 |

## Data flow

```
file input ─► app/importPhoto ─► platform/imageLoader (decode + tile) ─► app/imageRegistry (pixels)
                   │
                   └─► store.dispatch(setLayerImage) ─► project (metadata only)

pointer / wheel / keys ─► ui (DOM events) ─► tools/navigation ─► store.updateView(viewport)
                                   │ (events navigation leaves: clicks, Shift, double-clicks, keys)
                                   └─► active tool (tools/registry) ─► commands, selection, layer ─► store
                                                                          │
                                         core/commands/history ◄──────────┘ (one undo step each)

Open… ─► platform (file bytes) ─► app/projectFiles ─► core/io (unzip, parse, migrate, validate)
                                        └─► loader (photos, same ids) ─► registry; store.loadProject
Save  ─► app/projectFiles ─► core/io (serialize + zip with original photo bytes) ─► platform download
store change ─► app/autosave (1 s after the last change) ─► platform key-value store (IndexedDB)

store change ─► app/boardController (at most once per frame) ─► render/buildScene ─► Renderer.render
                                                                  │
     core/alignment/solveAlignment, core/connectivity/deriveNets (cached per project) ◄─┘
```

- **Project** (`core/model`): what will be saved — layers, photo metadata, mirror flag, board size,
  corner clicks, matched points and features: copper (trace vertices tied to anchors by id),
  components with a copy of their footprint's pads, planes with their attached anchors, silkscreen
  and notes. Changed
  only by commands (`core/commands`). Alignment transforms, residuals, outlier flags, nets and net
  colours are derived from it, never stored.
- **History** (`core/commands/history`): the project before each step; undo restores it exactly.
- **Tool state, selection and tool settings** (store): transient editor state, not saved. While a
  tool drags something (features, an alignment point), canvas and panel show the tool's `preview`.
- **View state** (`core/view`): active layer, viewport, overlay opacity, hidden photos. Looking at the
  board is not an edit, so view changes are not commands and are not saved with the project.
- **Pixels**: decoded photo tiles and the original file bytes live in the app's image registry, keyed
  by image id, outside the model, for as long as the project or its undo history refers to them.
- **Project file** (`core/io`): a `.pcbrt` zip with `project.json` (`schemaVersion` + project) and the
  original photos. Loading migrates older versions, validates with zod and checks references; a
  newer version is refused. The store remembers the last saved project to show unsaved changes.

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

- **All model mutations go through commands** (`execute`, recorded by the history for undo/redo); UI and
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
`src/platform/download.ts`, `src/platform/keyValueStore.ts`, `src/app/main.tsx`) are excluded from unit coverage and covered by the e2e tests.

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
