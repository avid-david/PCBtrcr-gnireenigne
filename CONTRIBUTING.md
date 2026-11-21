# Contributing

Thanks for helping! The engineering rules in [CLAUDE.md](CLAUDE.md) apply to every change; this page is
the short version plus the practical workflow.

## Setup

1. Install Node 24 LTS and pnpm 10.
2. `pnpm install`
3. `pnpm dev` and open http://localhost:5173.
4. For e2e tests, once: `pnpm exec playwright install chromium`.

## Making a change

- Work on one milestone from [docs/SPEC.md](docs/SPEC.md#milestones) at a time; don't build ahead.
- Put code in the right layer (see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)). `pnpm lint` fails if
  an import crosses a layer boundary.
- Write tests with the code. Core logic is test-first where practical; geometry and connectivity get
  property-based tests.
- Keep functions small: complexity ≤ 8, ≤ 40 lines, ≤ 3 parameters, nesting ≤ 3, files ≤ 300 lines.
  Inline `eslint-disable` comments are ignored and reported, so fix the code instead. If a limit is
  genuinely wrong for a case, explain why in the PR.
- No `any`, no non-null `!`, no `@ts-ignore`.
- Significant decisions get an ADR in `docs/adr/NNNN-title.md`.

## Before you push

```sh
pnpm format
pnpm lint && pnpm typecheck && pnpm test --coverage && pnpm build
pnpm crap
pnpm test:e2e
```

CI runs the same steps on every push and pull request.

## Commits and pull requests

- [Conventional Commits](https://www.conventionalcommits.org/): `feat:`, `fix:`, `refactor:`, `test:`,
  `docs:`, `chore:` — one logical change per commit.
- A PR that completes a milestone includes a short demo note (what to click to see it working).
- Keep `README.md`, `docs/ARCHITECTURE.md` and `CLAUDE.md` in sync when you change structure.

## Adding a dependency

Only when it saves substantial work. Prefer small, maintained, MIT/Apache/BSD-licensed packages, and say
why in the PR.
