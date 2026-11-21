# PCB Reverse Tracer — Product Specification

An open-source tool for reverse engineering printed circuit boards from photographs. The user imports a
photo of the top and bottom side of a board, aligns them, and traces copper features on each layer. The
tool works out which features are electrically connected and colors each net consistently.

Engineering rules: [CLAUDE.md](../CLAUDE.md).

## Users and goals

- Hobbyists, repair technicians and security researchers documenting an unknown board.
- Primary goal: produce an accurate, saveable map of the board's connectivity (a netlist) with as little
  clicking as possible.
- Non-goals for v1: automatic trace detection from images, schematic generation, Gerber/KiCad export,
  multi-layer (>2) boards, collaboration. The design must leave room for these (see *Extension points*).

## Glossary

| Term | Meaning |
| --- | --- |
| **Board space** | The shared coordinate system, in millimetres, viewed from the top. All features live here. |
| **Layer** | `top` or `bottom` copper side. Each has one source photo. More layers may come later. |
| **Source image** | The original imported photo. Never modified; only its transform changes. |
| **Alignment** | The projective transform (homography) mapping a source image's pixels into board space. |
| **Control point** | A pair (image pixel ↔ board position) used to compute an alignment. |
| **Feature** | Anything the user draws: trace, via, hole, pad, connection point, plane, text, silkscreen, component. |
| **Anchor** | A point that can carry a connection: pad, via, hole (plated), connection point, trace vertex. |
| **Net** | A set of anchors that are electrically connected. Derived, never stored. |
| **Footprint** | A reusable template of pads (e.g. 2×5 header, 0805 resistor) placed as a component. |

## Core concepts and rules

### Coordinates and images
- Board space is in mm, origin top-left, viewed from the top side.
- The bottom photo is taken from below, so on import it is **mirrored horizontally** by default (toggle
  available). Mirroring is part of its alignment transform, not a pixel edit.
- Display units: mm or mil (user setting); storage is always mm.

### Connectivity (the heart of the tool)
- Connections are **explicit**: a trace vertex snapped to a pad/via/another trace vertex is bound to that
  anchor's id. Nets are computed by union-find over these bindings.
- **Vias and plated through-holes** belong to both layers and join the nets on top and bottom.
- **SMD pads** belong to one layer. **Through-hole pads** belong to both.
- **Planes** (copper pours) are polygons on one layer; anchors the user explicitly attaches to a plane join
  its net. (Automatic geometric containment is a later enhancement.)
- Text and silkscreen have no connectivity.
- **One net = one color.** Colors come from a deterministic palette keyed by a stable net id, so colors do
  not shuffle when unrelated features change. The user can rename a net and override its color; overrides
  are stored against a member anchor so they survive net merges/splits predictably (document the rule in an ADR).
- Merging two nets keeps the name/color of the larger net; the UI shows a short notice.

### Layers and overlay
- The active layer is drawn fully opaque; the other layer can be shown as an overlay with adjustable
  opacity (0–100 %), so the user can see where vias line up. (No tint: decided in
  [ADR 0003](adr/0003-image-display.md).)
- Per layer: toggle visibility of photo, copper features, silkscreen, text.
- Features drawn on the inactive layer are dimmed and not editable until that layer is active
  (both-layer features such as vias are always editable).

## Features

### F1. Project and images
- Create a project, import top and bottom photos (PNG/JPEG/WebP; must handle at least 24 MP images).
- Pan (middle mouse / space-drag), zoom (wheel, centered on cursor), fit-to-view.
- Switch active layer (toolbar + shortcut `Tab`; Tab always switches layers, see
  [ADR 0003](adr/0003-image-display.md)).
- Fit to view: toolbar + shortcut `Home`.

### F2. Alignment (perspective matching / warping)
- Mode in which the user places control points on a photo and their target position in board space.
- Board outline step: the user sets the board size (W × H mm) and clicks its 4 corners on the top photo.
- Further control points can be vias, holes or corners visible on both photos; matching a point on the
  top and bottom photo aligns the bottom to the top.
- ≥ 4 points: compute homography (normalised DLT; least-squares for > 4 points).
- Show per-point residual error and RMS error in mm; highlight outliers (studentized residuals,
  see [ADR 0004](adr/0004-alignment.md)).
- Photos are warped on the GPU (perspective meshes) as the points change; the source is never
  modified and no warped copy is stored ([ADR 0004](adr/0004-alignment.md)).
- Live preview while dragging a control point.

### F3. Tracing tools
Each tool is a self-contained state machine with its own cursor, hint text and `Esc` to cancel.

| Tool | Behaviour |
| --- | --- |
| Select / move | Click, box-select, move, delete, edit properties in an inspector panel. |
| Trace | Click to add vertices, double-click/`Enter` to finish. Width property. Snaps to anchors. |
| Via | Click to place. Drill + pad diameter. Both layers. |
| Hole | Plated (both layers, connectable) or non-plated (mechanical, not connectable). |
| Pad / connection point | Single SMD or TH pad, round/rect/oval; generic test point or wire attach. |
| Plane | Draw polygon; attach anchors to its net. |
| Text | Free annotation (not part of the board). |
| Silkscreen | Lines and text on the silkscreen of a layer (designators, outlines). |
| Component | Place a footprint, rotate (`R`), flip to other side (`F`), set designator and value. |

- Snapping: to anchors (priority), then optional grid. Snap radius in screen pixels.
- Undo/redo for every action (`Ctrl+Z` / `Ctrl+Y`), unlimited within a session.
- Keyboard shortcut for every tool, shown in tooltips.

### F4. Footprint library (starter set)
Footprints are **data** (JSON validated by a schema) or **parametric generators**, so contributors can add
them without touching tool code.

- Pin headers: 1×N and 2×N, pitch 2.54 mm, 2.00 mm, 1.27 mm, N = 1…40.
- SMD chip (resistor/capacitor): 0201, 0402, 0603, 0805, 1206, 1210, 2512 (IPC nominal land pattern).
- SOT-23-3, SOT-23-5, SOT-23-6, SOIC-8/14/16 (1.27 mm), TSSOP-N (0.65 mm).
- Through-hole: DIP-N (2.54 mm, 7.62 mm row spacing), TO-92, TO-220.
- Generic: user-defined pad grid (rows × columns × pitch) for unknown parts.

### F5. Nets panel
- List of nets with name, color, member count; click to highlight a net across both layers.
- Rename, recolor, lock.
- Export netlist as JSON and CSV (net name → list of component.pin / anchor ids).

### F6. Persistence
- Save/load a single project file (`.pcbrt`): a zip containing `project.json` + original images.
- `project.json` has a `schemaVersion`; loading an older version runs migrations; unknown future versions
  are refused with a clear message.
- Autosave to browser storage every change (debounced); offer recovery on start.

## Non-functional requirements
- Smooth interaction (≥ 50 fps pan/zoom) with 2 × 24 MP images and 5 000 features on a mid-range laptop.
- Works in current Chrome, Edge and Firefox; keyboard- and mouse-driven; usable at 1366×768.
- No network access needed after load; no telemetry.
- Accessible UI controls (labels, focus states, sufficient contrast); dark theme default.

## Extension points (design for, don't build yet)
- `Tool` registry — new editing tools.
- Feature kind registry — new feature types with their own render, hit-test and serialization.
- Footprint library — JSON files / generator functions.
- `Exporter` interface — KiCad, Gerber, SVG, BOM exporters later.
- `ImageAnalyzer` interface — future automatic via/trace detection.
- Layer list is an array, not two hard-coded fields, so 4-layer boards are possible later.

## Milestones
Each milestone ends with passing CI, updated docs, and a short demo note in the PR description.

| # | Scope | Done when |
| --- | --- | --- |
| M0 | Scaffold: Vite + TS + React, lint/format/typecheck/test/coverage/dependency-cruiser, GitHub Actions CI, `README`, `CONTRIBUTING`, `ARCHITECTURE`, `LICENSE` (MIT), ADR 0001 (stack), empty app shell. | `pnpm dev` shows the shell; CI green; lint limits from CLAUDE.md active. |
| M1 | F1: import images, pan/zoom, layer switch, bottom mirror, overlay opacity. | Can view both photos and overlay them. |
| M2 | F2: alignment with residuals and cached warp. | Two real photos align to < 0.2 mm RMS with 6 good points (test with fixture images). |
| M3 | Model, commands + undo/redo, connectivity engine, net coloring; tools: select, trace, via, pad/connection point, hole. | Property tests for connectivity and undo pass; tracing a small board end-to-end works. |
| M4 | F6 persistence with schema versioning and autosave. | Round-trip tests for every feature kind; e2e: save, reload, identical state. |
| M5 | F4 footprints + component tool, plane, text, silkscreen. | Starter library complete; components' pads join nets. |
| M6 | F5 nets panel, highlight, netlist export. Polish, shortcuts help overlay. | v0.1.0 release tagged. |
