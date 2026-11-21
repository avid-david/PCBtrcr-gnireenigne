# CLAUDE.md — Engineering rules for PCB Reverse Tracer

These rules apply to every change, by Claude or by humans. The product spec lives in
[docs/SPEC.md](docs/SPEC.md). Architecture decisions live in `docs/adr/`.

## Stack (do not change without an ADR)

- **Language:** TypeScript, `strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`.
- **App:** browser app built with Vite. A Tauri wrapper for a Windows desktop build may be added later; the
  code must not assume either environment outside `src/platform/`.
- **UI:** React (function components + hooks). UI state in Zustand.
- **Rendering:** WebGL via PixiJS, hidden behind the `Renderer` interface in `src/render/`.
- **Tests:** Vitest (unit), fast-check (property tests for geometry/connectivity), Playwright (e2e smoke).
- **Quality:** ESLint (flat config) + Prettier, dependency-cruiser for layer boundaries.
- **Package manager:** pnpm. Node LTS.

## Architecture: layered, dependencies point inward

```
src/
  core/       Pure domain logic. NO DOM, NO React, NO PixiJS, NO browser APIs.
    geometry/     vectors, transforms, homography, hit-testing
    model/        Project, Layer, Feature types, Net, ids
    connectivity/ net derivation (union-find)
    commands/     undoable commands + history
    footprints/   footprint schema + parametric generators
    io/           versioned project (de)serialization + migrations
  tools/      One file per editor tool, each a small state machine implementing `Tool`.
  render/     Draws the model; reads state, never mutates it.
  ui/         React components. Thin: dispatch commands, show state.
  platform/   File access, storage, clipboard (browser vs desktop adapters).
  app/        Composition root: wires everything together.
```

- Outside `src/`: `scripts/` holds repo tooling (e.g. the CRAP check), `e2e/` the Playwright tests.
- `core` imports nothing from other `src/` folders. `tools` may import `core`. `render` and `ui` may import
  `core` and `tools`. Only `app` knows about everything. Enforce with dependency-cruiser in CI.
- **All model mutations go through commands** (`execute` / `undo`). No direct mutation from UI or tools.
- The model is plain, serializable data (no classes holding behavior in the persisted state).
- **Derived data is never stored:** nets and net colors are computed from connectivity, not saved per feature.
- Internal units are **millimetres** in **board space**. Image pixels exist only inside the alignment code.
- New tools, feature types, footprints and exporters are added by **registering** them, not by editing
  `switch` statements spread across the codebase.

## Code quality limits (enforced by ESLint and CI — keep the CRAP score low)

CRAP(fn) = complexity² × (1 − coverage)³ + complexity. Target: every function < 15, hard limit 30.

| Rule | Limit |
| --- | --- |
| Cyclomatic complexity per function | ≤ 8 (`complexity`) |
| Nesting depth | ≤ 3 (`max-depth`) |
| Lines per function | ≤ 40 (`max-lines-per-function`, skip blank/comments) |
| Parameters | ≤ 3; use an options object beyond that (`max-params`) |
| Lines per file | ≤ 300 (`max-lines`) |
| `any`, non-null `!`, `@ts-ignore` | forbidden (use `unknown` + narrowing) |
| Coverage `src/core/**` | ≥ 90 % lines and branches |
| Coverage overall | ≥ 75 % lines |

Do not disable a lint rule inline to pass CI. If a limit is genuinely wrong for a case, explain why in the PR.

## Style

- Prefer small pure functions and early returns over nested conditionals.
- Use discriminated unions (`kind: 'via' | 'trace' | ...`) plus a lookup table/registry instead of long `switch`es.
- Name things in domain language from [docs/SPEC.md](docs/SPEC.md#glossary) (net, via, pad, layer, footprint…).
- Errors at boundaries (file import, deserialization) return `Result<T, E>` types; core never throws for
  expected failures.
- Comments explain *why*, not *what*. Public functions in `core` get a one-line TSDoc.
- No dead code, no commented-out code, no TODOs without an issue link.

## Testing

- Write tests together with the code; core logic is written test-first where practical.
- Geometry and connectivity get property-based tests (e.g. "homography of its own 4 points is identity",
  "undo after execute restores the exact previous state", "net count never increases when adding a connection").
- Serialization: round-trip test for every feature kind, plus a fixture test per old schema version.
- Tests must be deterministic: no real timers, no network, seeded randomness.
- UI components get light tests only where they contain logic; push logic down into `core`/`tools` instead.

## Workflow

- Work one milestone from [docs/SPEC.md](docs/SPEC.md#milestones) at a time. Do not build ahead.
- Before finishing any task run: `pnpm lint && pnpm typecheck && pnpm test --coverage && pnpm build`.
  All must pass. Report real output; never claim a check passed without running it.
- Significant decisions (library choice, file format, coordinate conventions) get a short ADR in
  `docs/adr/NNNN-title.md` (context, decision, consequences).
- Keep `README.md`, `docs/ARCHITECTURE.md` and this file in sync with the code when you change structure.
- Commits: Conventional Commits (`feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`), one logical change each.
- Add a dependency only if it saves substantial work; prefer small, maintained, MIT/Apache/BSD-licensed packages.
