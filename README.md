# PCB Reverse Tracer

An open-source browser tool for reverse engineering printed circuit boards from photographs: import top
and bottom photos, align them, trace copper features, and let the tool derive and color the nets.

> **Status:** milestone M3 — import, overlay and align top/bottom photos, then trace copper (traces,
> vias, pads, connection points, holes) with nets coloured automatically and unlimited undo.
> Saving (M4) comes next. See [docs/SPEC.md](docs/SPEC.md#milestones).

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
| Tools | Select `S`, Trace `T`, Via `V`, Pad `P`, Connection point `C`, Hole `H`, Align `A` (left toolbar) |
| Undo / redo | `Ctrl+Z` / `Ctrl+Y` (or `Ctrl+Shift+Z`), or the header buttons |
| Grid snapping | `G` or the `#` toolbar button; the step is in the side panel |

### Aligning the photos

1. Press **Align** (`A`), enter the board's width and height in mm and press **Set size**.
2. On the top photo, click the board's corners: top-left, top-right, bottom-right, bottom-left.
   The top photo snaps onto the board outline.
3. Switch to **Matching points** (automatic after the 4th corner). Click a via, hole or corner on one
   photo; the view hops to the other photo — click the same feature there. Repeat for at least 4
   features (6+ lets the tool measure accuracy and spot mis-clicks).
4. The panel shows each point's error in mm, the RMS per layer, and marks outliers in red. Drag a
   point to adjust it (live preview) or delete it with ×.

Tip: set **Overlay opacity** to 0 % while clicking, so only the active photo is visible.

### Tracing

- **Trace** (`T`): click to add points, double-click or `Enter` to finish, `Backspace` removes the last
  point, `Esc` cancels. Points snap to pads, vias, holes, points and trace ends within 10 px; a snapped
  end is tied to that anchor and follows it when it moves.
- **Via / Pad / Point / Hole** (`V` `P` `C` `H`): click to place with the sizes shown in the side panel.
  SMD pads and points go on the active layer; vias, plated holes and through-hole pads join both layers.
- **Select** (`S`): click (Shift adds), drag to move, drag on empty board to box-select, `Delete`
  removes. The side panel edits the selected feature and shows its net; the sizes you set become the
  defaults for the next one.
- Everything electrically connected shares one colour. Features on the inactive layer are dimmed and
  can only be edited from their own layer.

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
