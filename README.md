# PCB Reverse Tracer

An open-source browser tool for reverse engineering printed circuit boards from photographs: import top
and bottom photos, align them, trace copper features, and let the tool derive and color the nets.

> **Status:** milestone M0 (project scaffold). The app shows an empty shell; features arrive from M1 on.
> See [docs/SPEC.md](docs/SPEC.md#milestones).

## Quick start

Requirements: Node 24 LTS (see `.nvmrc`) and pnpm 10 (`npm i -g pnpm@10`, or `corepack enable`).

```sh
pnpm install
pnpm dev            # http://localhost:5173
```

## Scripts

| Command | What it does |
| --- | --- |
| `pnpm dev` | Vite dev server with hot reload |
| `pnpm build` | Production build into `dist/` |
| `pnpm preview` | Serve the production build |
| `pnpm lint` | ESLint (incl. code-quality limits) + dependency-cruiser layer rules |
| `pnpm format` / `format:check` | Prettier write / check |
| `pnpm typecheck` | `tsc -b` over core (no DOM), app and tooling projects |
| `pnpm test` | Vitest unit tests; add `--coverage` for coverage + thresholds |
| `pnpm crap` | CRAP score per function (needs a prior `pnpm test --coverage`) |
| `pnpm test:e2e` | Playwright smoke test against the production build |

The first `pnpm test:e2e` needs a browser: `pnpm exec playwright install chromium`.

Before opening a PR run:

```sh
pnpm lint && pnpm typecheck && pnpm test --coverage && pnpm build
```

## Documentation

- [docs/SPEC.md](docs/SPEC.md) — product specification and milestones
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — layers and where code goes
- [docs/adr/](docs/adr/) — architecture decision records
- [CLAUDE.md](CLAUDE.md) — engineering rules (for humans and AI assistants)
- [CONTRIBUTING.md](CONTRIBUTING.md) — how to contribute

## License

[MIT](LICENSE)
