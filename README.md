# PCB Reverse Tracer

An open-source browser tool for reverse engineering printed circuit boards from photographs: import top
and bottom photos, align them, trace copper features, and let the tool derive and color the nets.

> **Status:** milestone M5 — import, overlay and align top/bottom photos, trace copper (traces, vias,
> pads, connection points, holes, planes) with nets coloured automatically, place components from a
> footprint library, add silkscreen and notes, and save or open projects as `.pcbrt` files with
> autosave. The nets panel and netlist export (M6) come next. See [docs/SPEC.md](docs/SPEC.md#milestones).

## Using it

| Action | How |
| --- | --- |
| Import photos | **Import top photo…** / **Import bottom photo…** (PNG, JPEG, WebP, up to 100 MP) |
| Switch active layer | `Tab` or the **Top / Bottom** buttons |
| Pan | Middle-mouse drag, or hold `Space` and drag |
| Zoom | Mouse wheel (zooms around the cursor) |
| Fit to view | `Home` or **Fit to view** |
| Overlay | **Overlay opacity** slider: how strongly the inactive layer shows over the active one |
| Per layer | **Show photo**, **Show copper**, **Show silkscreen**, **Show notes**, **Mirror horizontally** (the bottom photo starts mirrored) |
| Tools | Select `S`, Trace `T`, Via `V`, Pad `P`, Connection point `C`, Hole `H`, Component `U`, Plane `L`, Silkscreen `K`, Text `X`, Align `A` (left toolbar) |
| Rotate / flip | `R` / `F` on selected components, or while placing one |
| Undo / redo | `Ctrl+Z` / `Ctrl+Y` (or `Ctrl+Shift+Z`), or the header buttons |
| Grid snapping | `G` or the `#` toolbar button; the step is in the side panel |
| Save / open | `Ctrl+S` / `Ctrl+O`, or **Save** / **Open…** (a `.pcbrt` file; see below) |

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

### Components, planes, silkscreen and notes

- **Component** (`U`): pick a footprint in the side panel (pin headers, chip sizes 0201–2512,
  SOIC, TSSOP, DIP, SOT-23, TO-92, TO-220, or a pad grid for unknown parts), set its parameters,
  designator prefix and value, then click to place. Designators count up (R1, R2…). `R` turns the
  part, `F` places it on the other side. Each pad is its own anchor, so traces snap to pads.
- Select a component to edit its designator, value and rotation, or press `R` / `F`. Flipping
  releases traces from the old side; they keep their shape.
- **Plane** (`L`): click the corners of a copper pour, double-click or `Enter` to finish. Pads and
  vias join its net only when attached: **Attach anchors inside outline**, or select the plane and
  some pads or vias (Shift) and press **Attach … to plane**.
- **Silkscreen** (`K`): lines, or text (switch in the side panel). **Text** (`X`): notes that are not
  part of the board. Edit their text in the side panel.

### Saving

- **Save** (`Ctrl+S`) downloads `<name>.pcbrt`: a zip with `project.json` and the original photos,
  unchanged. **Open…** (`Ctrl+O`) loads one; the next save uses its name. The header shows the file
  name and a ● while there are unsaved changes; opening another file or starting a new project with
  unsaved changes asks first.
- Each save is a new download, so the browser may name it `board (1).pcbrt`.
- Your work is also autosaved in the browser one second after every change. If you close the tab
  with unsaved changes, the next start offers to **Restore** or **Discard** them.
- Undo history, view, selection and tool settings are not saved; nets and alignment are recalculated.

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
| `pnpm test:e2e` | Playwright end-to-end tests against the production build |

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
