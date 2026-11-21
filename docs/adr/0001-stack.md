# ADR 0001: Technology stack and quality tooling

- **Status:** accepted
- **Date:** 2026-11-21

## Context

PCB Reverse Tracer is a browser-first editor that must stay smooth with two 24 MP photos and thousands of
features, run offline, and possibly ship later as a Windows desktop app. It is open source and will be
changed by humans and AI assistants alike, so the code-quality rules in CLAUDE.md must be enforced by
tools, not by goodwill.

## Decision

**Application**

- TypeScript in strict mode with `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`,
  `verbatimModuleSyntax` and `erasableSyntaxOnly`.
- **TypeScript 6.0**, not 7.0: typescript-eslint 8.73 supports TypeScript `<6.1`. Revisit once
  typescript-eslint supports the TypeScript 7 native compiler.
- Vite 8 for dev server and bundling; React 19 with function components and hooks.
- Zustand (UI state) and PixiJS (WebGL rendering behind a `Renderer` interface) are part of the stack
  but are added in M1, when the first code uses them. M0 installs only what the shell uses.
- A Tauri desktop wrapper may come later; environment-specific code lives only in `src/platform/`.

**Quality tooling**

- ESLint 10 flat config with `typescript-eslint` `strictTypeChecked` + `stylisticTypeChecked`, React Hooks
  and React Refresh rules, and Prettier (`eslint-config-prettier`) for formatting.
- CLAUDE.md limits are ESLint errors: `complexity` 8, `max-depth` 3, `max-lines-per-function` 40,
  `@typescript-eslint/max-params` 3, `max-lines` 300 (both line limits skip blank lines and comments),
  `no-explicit-any`, `no-non-null-assertion`, `ban-ts-comment`. Lint runs with `--max-warnings 0`.
- `linterOptions.noInlineConfig: true`: `eslint-disable` comments are ignored and reported, so
  limits cannot be bypassed inline (CLAUDE.md: "Do not disable a lint rule inline").
- **Exception:** `max-lines-per-function` is off for `*.test.ts(x)` and `e2e/`. A `describe` block is a
  list of small independent cases; limiting it to 40 lines only forces arbitrary splitting. All other
  limits still apply to tests.
- dependency-cruiser enforces the layer rules from CLAUDE.md. Beyond CLAUDE.md, `platform` may import
  only `core`, so adapters stay swappable.
- `src/core` is additionally type-checked by `tsconfig.core.json` without DOM or Node types, so a browser
  API in core is a compile error, not just a review comment.
- Vitest 5 (v8 coverage) with thresholds: `src/core/**` ≥ 90 % lines and branches, overall ≥ 75 % lines.
  `src/app/main.tsx` is excluded from unit coverage; it only mounts React and is covered by the e2e test.
- **CRAP score:** no ESLint rule computes it, so `scripts/crap.ts` takes per-function complexity from
  ESLint and statement coverage from `coverage/coverage-final.json`. It fails above 30 and warns from 15.
  It runs on Node 24's native TypeScript type stripping, so needs no extra runner.
- Playwright 1.65 smoke test (Chromium only) against the production build; fast-check is added in M3 with
  the first geometry/connectivity code.
- Prettier does not format Markdown, so hand-written tables in docs stay compact.
- pnpm 10 (pinned through `packageManager`), Node 24 LTS (`.nvmrc`), GitHub Actions on `ubuntu-latest`.

## Consequences

- Any import across a layer boundary, any over-complex function, and any inline lint disable fails CI.
- Contributors need Node 24+ (native type stripping runs `scripts/crap.ts`).
- The CRAP check is approximate: it matches ESLint's report line to the innermost covered function and
  uses statement coverage. That is good enough to flag risky functions; it is not a precise metric.
- Upgrading to TypeScript 7 is blocked on typescript-eslint and will need its own change.
