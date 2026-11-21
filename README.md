# PCB Reverse Tracer

An open-source browser tool for reverse engineering printed circuit boards from photographs: import top
and bottom photos, align them, trace copper features, and let the tool derive and color the nets.

> **Status:** milestone M2 — import top/bottom photos, overlay them and align them in perspective.
> Tracing (M3) comes next. See [docs/SPEC.md](docs/SPEC.md#milestones).

## Using it

| Action | How |
| --- | --- |
| Import photos | **Import top photo…** / **Import bottom photo…** (PNG, JPEG, WebP, up to 100 MP) |
| Switch active layer | `Tab` or the **Top / Bottom** buttons |
| Pan | Middle-mouse drag, or hold `Space` and drag |
| Zoom | Mouse wheel (zooms around the cursor) |
| Fit to view | `Home` or **Fit to view** |
| Overlay | **Overlay opacity** slider: how strongly the inactive layer shows over the active one |
| Per layer | **Show photo**, **Mirror horizontally** (the bottom photo starts mirrored) |
| Align mode | **Align** or `A`; `Esc` cancels a half-made match |

### Aligning the photos

1. Press **Align**, enter the board's width and height in mm and press **Set size**.
2. On the top photo, click the board's corners: top-left, top-right, bottom-right, bottom-left.
   The top photo snaps onto the board outline.
3. Switch to **Matching points** (automatic after the 4th corner). Click a via, hole or corner on one
   photo; the view hops to the other photo — click the same feature there. Repeat for at least 4
   features (6+ lets the tool measure accuracy and spot mis-clicks).
4. The panel shows each point's error in mm, the RMS per layer, and marks outliers in red. Drag a
   point to adjust it (live preview) or delete it with ×.

Tip: set **Overlay opacity** to 0 % while clicking, so only the active photo is visible.

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
