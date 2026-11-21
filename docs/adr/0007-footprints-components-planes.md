# ADR 0007: Footprints, components, planes, text and silkscreen

- **Status:** accepted
- **Date:** 2026-11-21

## Context

M5 adds the footprint library (SPEC F4) and the component, plane, text and silkscreen tools
(SPEC F3). Footprints must be data or generators that contributors add without touching tool
code. A component's pads must join nets like any other pad. Planes join only anchors the user
explicitly attaches. New feature kinds need a new file format version (ADR 0006).

## Decision

**Footprints** (`core/footprints`) are plain data: numbered pads (position, shape, size, drill;
drill 0 = surface mount) and silkscreen polylines, in mm, centred on the part and seen from the
side it is mounted on.

- **Fixed parts** (SOT-23-3/5/6, TO-92, TO-220-3) are JSON files in `core/footprints/parts/`,
  validated by `partSchema` (zod). An invalid file is reported by name, never skipped silently.
- **Families** (pin headers 1×N/2×N at 2.54/2.00/1.27 mm, chips 0201–2512, SOIC-8/14/16,
  TSSOP-8…28, DIP-4…40, a generic pad grid) are generator functions with typed parameters
  (`integer`, `number`, `choice`). The side panel builds its form from the parameter list.
- Both are entries in `FOOTPRINT_LIBRARY`; adding one is adding an entry.

**Land patterns** use IPC-7351B nominal density, taken from the KiCad footprint library
(gitlab.com/kicad/libraries/kicad-footprints, fetched 2026-11-21; dimensions are facts, not
copied artwork). Pad centre x / pad size in mm:

| Part | Pads |
| --- | --- |
| 0201 / 0402 / 0603 | ±0.32, 0.46×0.40 / ±0.51, 0.54×0.64 / ±0.825, 0.80×0.95 |
| 0805 / 1206 / 1210 / 2512 | ±0.9125, 1.025×1.40 / ±1.4625, 1.125×1.75 / ±1.4625, 1.125×2.65 / ±2.9625, 1.225×3.35 |
| SOT-23-x | x ±1.1375, pitch 0.95, 1.325×0.60 |
| SOIC (1.27) / TSSOP (0.65) | x ±2.475, 1.95×0.60 / x ±2.875, 1.55×0.40 |
| DIP / headers | 1.6 round, drill 0.8, rows 7.62 / 1.7, 1.35, 1.0 square-or-round, drill 1.0, 0.8, 0.65 |
| TO-92 / TO-220-3 | pitch 1.27, 1.05×1.5 oval, drill 0.75 / pitch 2.54, 1.905×2.0 oval, drill 1.1 |

Pin 1 is square (through-hole) where the package marks it. Dual-row parts count down the left
row and back up the right; 2-row headers count across (1 2 / 3 4 / …).

**Components** keep **a copy of their pads and outline**, plus which library entry and
parameters they came from. Correcting a footprint later never moves pads of saved projects.
Each pad has its own id and is an anchor; surface-mount pads are on the component's layer,
through-hole pads on every layer. Position in board space = `at + rotate(mirror(local))`:
rotation is clockwise on screen (board y points down), and `flipped` mirrors the part as seen
from the top when it is mounted on the bottom side. `R` turns by 90°, `F` flips. Flipping
releases trace ends and plane attachments that reach its surface-mount pads from the old
side, since they would now cross layers; trace ends stay where they were. A component is
edited only from its own side; its through-hole pads can be traced from both.

**Connectivity.** Each feature kind declares, besides its anchors, the **groups of anchors it
joins**: a trace joins all its vertices, a via or pad is one anchor, a component joins none of
its pads, a plane joins its `attached` list. Union-find runs over these groups and the trace
bindings (ADR 0005). A feature has one net only if it joins its anchors (a component does not;
its pads are coloured one by one).

**Planes** are an outline on one layer plus an explicit list of attached anchor ids
(SPEC "Connectivity"). "Attach anchors inside outline" is one explicit, undoable step that
attaches every pad, via, plated hole and point inside the outline on the plane's layer, but no
trace vertices, because a trace crossing a pour is often isolated from it. Deleting a feature
drops its anchors from every plane. Automatic containment stays a later enhancement.

**Text and silkscreen.** A note (`text`) is an annotation on one layer, drawn in a neutral
yellow and not part of the board. Silkscreen lines and text are drawn in white; bottom-side
silkscreen text and the designators of flipped parts are mirrored, as they look from the top.
Text size in the model is its line height; core estimates its width (0.6 × height per
character) for hit-testing, and the renderer scales glyphs to that height. Pixi `Text` objects
are reused by key, so an edit only re-renders texts that changed.

**Per-layer visibility.** Copper, silkscreen and notes can be hidden per layer (view state, not
saved). Features on every layer (vias, holes) follow the active layer's toggles.

**File format version 2** (`core/io/schemaV2.ts`) extends the frozen version 1 schema with the
new kinds; the version 1 → 2 migration only renumbers. Loading additionally refuses duplicate
ids, plane attachments to missing anchors and features on missing layers. `project.json` is
written in the schema's key order, so the same project always gives the same text.

## Consequences

- Contributors add footprints as JSON files or generator entries, with tests that check every
  family's pin numbering and centring automatically.
- Components are larger in the file (their pads are stored), which is what keeps them stable.
- Editing one pad of a placed component is not possible yet; replace the component instead.
- Many text labels cost texture memory; reusing them keeps edits cheap, but very large boards
  with thousands of designators are untested against the 50 fps target.
