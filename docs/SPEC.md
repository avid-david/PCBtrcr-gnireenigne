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
| **Landmark** | A matched point between two photos used by the alignment (F2's control point between layers). |
| **Object type** | A row in the layer panel (traces, vias, pads, …) with its own View and Select toggles (F8). |
| **Part type** | What a component is (resistor, N-MOSFET, connector, …), independent of its footprint. Part types are grouped in **categories** (F11). |
| **Pin name** | Optional name of a component pad (e.g. `SDA`, `VBUS`), shown next to its pin number. |
| **Probe** | One of the two points picked by the continuity check (F10). |
| **BOM** | Bill of materials: the placed components grouped into lines with a quantity. Derived, never stored. |
| **Find** | Searching components, pins and nets by name and jumping to the result (F14). |
| **Ruler** | The Measure tool that shows the distance between two board points (F15). Not saved. |
| **Board check** | A list of likely tracing mistakes found in the project, e.g. a pin connected to nothing (F16). Derived, never stored. |
| **Finding** | One row of the board check: the rule that found it, a short text and the feature it points at. |
| **View orientation** | How the screen shows board space: seen from the top or from below, turned by 0°, 90°, 180° or 270° (F17). View state; board space never changes. |

## Core concepts and rules

### Coordinates and images
- Board space is in mm, origin top-left, viewed from the top side.
- The bottom photo is taken from below, so on import it is **mirrored horizontally** by default (toggle
  available). Mirroring is part of its alignment transform, not a pixel edit.
- Display units: mm or mil (user setting); storage is always mm.
- The screen may show the board from below or turned by quarter turns (F17). That is a view setting:
  board space, stored positions and every number the user reads or types stay as seen from the top.

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
- Per layer: toggle visibility of photo, copper features, silkscreen, text. (Replaced by object rows in
  M10, see F8.)
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
| Via | Click to place. Drill + pad diameter. Both layers. Drag to size from M7 (F7). |
| Hole | Plated (both layers, connectable) or non-plated (mechanical, not connectable). |
| Pad / connection point | Single SMD or TH pad, round/rect/oval; generic test point or wire attach. |
| Plane | Draw polygon; attach anchors to its net. |
| Text | Free annotation (not part of the board). |
| Silkscreen | Lines and text on the silkscreen of a layer (designators, outlines). |
| Component | Place a footprint, rotate (`R`), flip to other side (`F`), set designator and value. Picker by category from M13 (F12). |

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

### F7. Tool groups, Shift shortcuts and via sizing
- The toolbar shows tools in labelled groups, separated by a rule: Select · **Connections** (Trace `T`,
  Via `V`, Pad `P`, Connection point `C`, Hole `H`, Plane `L`) · **Components** (Component `U`) ·
  **Annotations** (Silkscreen `K`, Text `X`) · **Measure** (Continuity `M`, F10; Ruler `Shift+M`, F15) ·
  **Align** (`A`). A tool declares its group when it is registered. No fly-out menus: every tool stays
  one click and one key away.
  A group without a registered tool is not shown (Measure appears with the Continuity tool in M11).
- Shortcuts may use Shift + key. A Shift + letter with no binding of its own acts as the plain letter
  (as today), so holding Shift by accident does not lose a shortcut.
- **Via tool**
  - Click (press and release within 3 screen px) places a via at the current size, centred on the
    grid-snapped press point. Placement happens on release, not on press.
  - Press and drag: the press point is the centre and the distance to the cursor is the pad radius. A
    ghost circle follows, and the hint shows the diameter in display units. Release places the via. Its
    pad becomes the new default, and its drill = pad × (default drill ÷ default pad), rounded to
    0.01 mm. The pad is clamped to 0.1–10 mm; the radius does not snap to the grid.
  - **Armed:** while no via size is known in this session, a click does not place anything and the hint
    asks the user to drag from the centre of a via to its edge; no ghost via is shown while armed and not
    dragging. A size is known after a drawn via, after
    an inspector edit of a via or of the via defaults, or after loading a project that has vias (the
    newest via's size becomes the default).
  - `Shift+V` picks the Via tool armed, also when it is already active, so the next via is drawn to size.
  - `Esc` cancels a drag in progress. `Esc` while armed and not dragging disarms, if a size is known.
- **Resize handles:** when exactly one editable via, hole or connection point is selected, the Select tool
  shows a round handle on its edge. Dragging the handle sets the diameter (via: the pad, and the drill
  keeps its ratio), with a live preview, as one undo step. The new size becomes the tool default, like
  an inspector edit. The handle wins over feature hits under it. Same clamps as drawing.
  The handle is shown only while the feature's on-screen radius is at least 8 px, so it never covers
  the centre of a small via at low zoom: pressing there always moves the feature. To resize a smaller
  one, zoom in or use the inspector.
- Edge cases: a drag that ends on the centre gives the minimum size. A drag interrupted by a layer
  switch (`Tab`) is dropped. The drill always stays smaller than the pad and at least 0.01 mm: after
  rounding it is clamped to 0.01 mm … the largest 0.01 mm step below the pad (a 0.1 mm pad gets at most
  0.09 mm).
- Shortcuts: `Shift+V` (Via tool, armed).

### F8. Object types: visibility and selectability
- Each layer's fieldset in the layer panel keeps Show photo and Mirror. Its Show copper / silkscreen /
  notes toggles are replaced by **object rows**, each with a **View** and a **Select** toggle: Traces,
  Pads, Connection points, Planes, Components (outline, designator and the component's pads),
  Silkscreen, Notes.
- A shared "Both layers" fieldset has rows for Vias and Holes. Stand-alone through-hole pads follow the
  active layer's Pads row.
- **Hidden** (View off): not drawn, not hit by click or box select, not a snap target (trace ends, plane
  attach, continuity probes). Connectivity, nets, the BOM and all exports are unaffected.
- **Not selectable** (Select off): drawn, cannot be selected, still a snap target, like a locked net
  ([ADR 0008](adr/0008-net-styles-and-exporters.md)).
- Turning a row off removes its features from the current selection. Placing a feature of a hidden type
  turns that row's View back on, and the status bar says so.
- Each fieldset has a "Show all" button. Everything is on by default. This is view state: not saved, not
  undoable.

### F9. Landmarks from overlapping vias
A via is one object on both layers. When the photos are not quite aligned, the user sees the same hole in
two places and tends to place a second via next to the first one. That is a free alignment landmark.

- When a newly placed via's pad overlaps an existing via's pad (centre distance smaller than the sum of
  the radii, and at least 0.05 mm), and both the active layer and another layer have a photo, the status
  bar offers: "Overlaps via at (x, y) — same via?" with **Use as landmark** and **Keep both**.
- **Use as landmark** (one undo step): removes the new via and adds a matched point. Its pixel on the
  other layer is the existing via's centre mapped through that layer's current transform. Its pixel on
  the active layer is the new via's centre mapped through the active layer's transform. The alignment is
  solved again; the existing via keeps its board position. This assumes the existing via was placed
  against the other photo (recorded in the ADR).
- The offer goes away on Keep both, `Esc`, any other edit, or the next via. Only one offer is shown at a
  time; ignoring it keeps both vias.
- The Align panel has a per-browser preference "Offer landmarks from overlapping vias" (on by default).
- The new match behaves like any other match: it has a residual, can be flagged as an outlier, and can be
  deleted in the Align panel.
- Edge cases: centres closer than 0.05 mm give no offer (they carry no information). With only one photo
  there is no offer. If the existing via is hidden or in a locked net, the offer still appears, and
  accepting does not change the existing via.

### F10. Continuity check
- Tool **Continuity** (`M`, Measure group). The first click sets probe **A**, the second sets probe **B**.
- A probe is the anchor under the cursor (snap rules of the trace tool, visible features only), else the
  trace or plane under the cursor, else nothing (the hint says "No copper here").
- The result shows in the hint and the status bar:
  - **Connected**: the net name and the path, e.g. "2 traces · 1 via · 2 traces".
  - **Not connected**: the net name of each probe.
  - The same anchor twice: "Same point".
- When connected, the shortest path (fewest features) from A to B is drawn at full strength and
  everything else dimmed, like the net highlight. The probes are shown as markers A and B.
- A third click starts a new check from that point. `Esc` clears the check.
- The result is tool state: not saved and not an edit. It is recomputed when the project changes (e.g.
  undo). If a probe's anchor is deleted, the check clears.
- Hidden features still conduct, but they are not drawn and cannot be probes.
- Shortcuts: `M`.

### F11. Component details
- A component additionally has a **part type**, **description**, **manufacturer**, **part number** and
  **datasheet**. The datasheet is text, shown as an "Open" link when it is an http(s) URL; the link opens
  in a new browser tab and the app never fetches it. Each component pad has an optional **pin name**.
- Inspector for a component: Part type (a choice grouped by category), Designator, Value, Description,
  Manufacturer, Part number, Datasheet, Rotation. A Pins table lists each pin number with an editable
  name; `Enter` commits and moves to the next pin.
- Part types are a registry (id, label, category, designator prefix, suggested footprints); adding one
  is adding an entry. Starter set:

  | Category | Part types (designator prefix) |
  | --- | --- |
  | Passives | Resistor (R), Capacitor (C), Inductor (L), Ferrite bead (FB), Fuse (F), Crystal / resonator (Y) |
  | Diodes | Diode, Zener, TVS, LED (all D) |
  | Transistors | NPN, PNP, N-MOSFET, P-MOSFET, Unknown transistor (all Q) |
  | ICs | IC, Voltage regulator (U) |
  | Connectors | Connector (J), Test point (TP) |
  | Switches | Switch (SW), Relay (K) |
  | Other | Unknown part (U) |

- Changing the part type renames an **automatic** designator (the old prefix + a number) to the new
  prefix with the next free number, e.g. Q1 → D3 when a SOT-23 turns out to be a diode. A designator
  the user typed stays. The change is one undo step.
- **Hover readout** (every tool): over a component pad the status bar shows e.g.
  "U3 pin 5 (SDA) · net I2C_SDA"; over any other anchor, its kind and net.
- Project file version 4. The 3 → 4 migration infers the part type from the designator's letter prefix:
  R, C, L, D, Q (→ Unknown transistor), U, J / P / CN (→ Connector), SW / S (→ Switch), Y / X (→ Crystal),
  F, FB, K, TP; anything else → Unknown part. The other new fields start empty.

### F12. Component picker by category
- Replaces the flat Footprint list of the component tool: **category → part type → footprint**.
- The footprint list shows the part type's suggested footprints first, then "All footprints" (the whole
  library). The footprint stays master: any footprint can carry any part type, e.g. SOT-23-3 as an
  N-MOSFET, a diode or a regulator.
- Footprint parameters and Value work as today. The designator prefix defaults to the part type's prefix
  and stays editable.
- A search field filters part types and footprints by name (e.g. "sot", "mosfet"). Typing in it never
  triggers shortcuts. The last choice is remembered for the session.
- Edge cases: a library entry that no part type suggests appears only under "All footprints". A registry
  test fails if a part type suggests a footprint that is not in the library.

### F13. Bill of materials
- New side panel tab **Parts** (Layers · Nets · Parts), listing one **line** per combination of part
  type, value, footprint name, manufacturer and part number.
- Columns: Qty, Designators (natural order, e.g. `R1, R2, R5`), Type, Value, Footprint, Manufacturer,
  Part number, Description (distinct descriptions joined with `; `), Datasheet (the first non-empty one).
- Lines are sorted by category order, then by their first designator. An empty designator shows as `?`.
  Duplicate designators are flagged ("R3 used twice").
- Clicking a designator selects that component and makes its side the active layer.
- Export: **BOM CSV** (RFC 4180, CRLF, the columns above) and **BOM JSON** (`{ "lines": [...] }`, with
  designators as arrays). Exporters declare a group (`netlist` or `bom`), and each panel shows the
  export buttons of its own group.
- Only components count; stand-alone pads and connection points are not parts. The BOM is derived from
  the project and never stored.

### F14. Find
- `Ctrl+F` (or the Find button in the header) opens a find field over the board and focuses it. While
  the app has focus, `Ctrl+F` replaces the browser's find in page. Typing in the field never triggers
  shortcuts.
- The query matches, case-insensitively and as a substring:
  - **Components**: designator, value, part number, description.
  - **Pins**: `designator.pin` (e.g. `U3.5`) and pin names (e.g. `SDA`, F11).
  - **Nets**: the name shown in the Nets panel, including automatic names such as `Net 12`.
- Results are listed under Components · Pins · Nets, at most 20 per group with "and N more". Within a
  group, exact matches come first, then matches at the start of a word, then the rest; ties in natural
  designator / name order. Each row shows a short context, e.g. "U3 · ATmega328P · top" or
  "Net GND · 14 members".
- `↑` / `↓` move through the rows, `Enter` or a click jumps to the highlighted one, `Esc` closes the
  field and gives focus back to the board.
- **Jump**: the view fits the result's bounds with a 20 % margin, but never zooms in further than a
  10 mm × 10 mm area would. A component or pin becomes the selection and its side the active layer (as a
  BOM click, F13). A net is highlighted as from the Nets panel and the view fits all its members.
- Finding and jumping are view and selection changes: not saved and not undoable.
- Edge cases: an empty query lists nothing; no match shows "No matches". A result whose object type is
  hidden (F8) is still listed; jumping to it turns that row's View back on and the status bar says so.
  Members of a locked net can be found and highlighted, not selected.
- Shortcuts: `Ctrl+F`.

### F15. Ruler
- Tool **Ruler** (`Shift+M`, Measure group). The first click sets the start, the second the end; between
  them a line follows the cursor with a live length.
- Each end snaps like a trace vertex: to the anchor centre under the cursor (visible features only), then
  to the grid when it is on. Holding `Shift` constrains the line to multiples of 45°.
- The readout shows in the hint, the status bar and a label at the line's middle: length, Δx, Δy and
  angle, in display units (e.g. "2.54 mm · Δx 2.54 · Δy 0.00 · 0°"). When the active layer's alignment
  has an RMS error, the hint adds it ("alignment RMS 0.12 mm") as a reminder of the accuracy.
- A finished measurement stays on screen until `Esc`, another tool, or the next click, which starts a new
  measurement from that point.
- The ruler measures in board space, so it stays put when the active layer changes. It is tool state:
  not saved, not an edit, not exported.
- Edge cases: the same point twice gives "0 mm". A snapped anchor that is deleted (e.g. by undo) leaves
  the measurement at its last position.
- Shortcuts: `Shift+M`.

### F16. Board check
A list of places where the tracing is probably unfinished or wrong, so the user can work through them
instead of searching the board by eye.

- New side panel tab **Check** (Layers · Nets · Parts · Check). While it is shown, its label shows the
  number of findings, e.g. "Check (7)". While another tab is shown the label is just "Check", because
  the list is not computed then (see below), so it never shows a stale count.
- Rules are a registry (id, label, a pure function from the project and its nets to findings); adding a
  rule is adding an entry. Starter rules, in this order:

  | Rule | Finds | Example text |
  | --- | --- | --- |
  | Unconnected pin | A component pad that is alone in its net: no trace, via, plane or other pad joins it. | "U3 pin 5 (SDA) is not connected" |
  | Touching, not connected | A trace end that lies on copper of the same layer that is not in its net: inside a pad's shape, a via's pad, a plated hole or a connection point, or within half the larger trace width of another trace's vertex or segment. The end's own trace does not count. When the end lies on an anchor and also on a segment, the anchor is named. | "Trace end lies on U3 pin 5 but is not connected to it" · "Trace end lies on a trace of net GND but is not connected to it" |
  | Open trace end | The first or last vertex of a trace that is free and that no other trace vertex binds to and no plane attaches, and that no "Touching, not connected" finding already covers. | "Trace end at (12.40, 8.10) connects to nothing" |
  | Unused via | A via or plated hole that is alone in its net. | "Via at (30.00, 4.25) connects nothing" |
  | Designator | A component with an empty designator, or a designator used more than once (the same rule as the BOM flag, F13). | "R3 used twice" · "Component without designator" |

- Rows are grouped by rule, with a count per group, and ordered within a group by natural designator
  order, then by position (top to bottom, then left to right, seen from the top). Each row shows the
  text and the side (top, bottom, both). Positions are in display units.
- Each group has a checkbox that shows or hides its rows and their share of the tab's count. Everything
  is shown by default. This is view state: not saved, not undoable.
- Clicking a row, or `Enter` on a focused row, **jumps** as Find does (F14): the view frames the feature,
  it becomes the selection (the component for a pin finding, the trace for a trace-end finding) and its
  side becomes the active layer. A hidden object type is turned back on and the status bar says so.
  Members of a locked net are framed, not selected.
- The list is computed when the tab is opened and again after every edit (including undo) while the tab
  is shown, and not at all while it is hidden. An empty list says "No findings".
- Findings are hints, not errors: a pin with no connection can be correct (an unused pin). Nothing blocks
  saving or exporting. The findings are not saved and not exported.
- Hidden features (F8) are still checked; the check works on the project, not on what is drawn.
- Edge cases: a bound trace end is never open. Two free trace ends at the same place that are not bound
  give one "Touching, not connected" finding, not two. A trace end inside a plane's outline is not
  reported as touching (plane containment is not automatic, see *Connectivity*), but it is reported as
  open if nothing attaches it. Mechanical holes are never reported.

### F17. View from below and view rotation
Lets the user look at the board as if it were turned over or turned around in the hand, so the bottom
photo reads naturally and a long board fits the screen. Only the screen changes: board space, stored
positions and every number shown or typed stay as seen from the top.

- **View from below** (`B`, or the "Seen from" switch in the header: Top · Below) mirrors the board view
  horizontally. The board point at the centre of the board view stays there.
- **Rotate view**: `.` turns the view 90° clockwise, `,` 90° counter-clockwise, about the centre of the
  board view. There are four positions (0°, 90°, 180°, 270°).
- The orientation does not depend on the active layer: `Tab` still only switches the layer.
- When the orientation is not "top, 0°", the status bar shows it, e.g. "Seen from below · 90°". Clicking
  it returns to top, 0°.
- Everything drawn in board space follows: photos, features, overlay, selection, ghosts, resize handles,
  alignment markers, continuity markers and the ruler.
- **Text** reads correctly for the side it is on: seen from below, bottom-side silkscreen and the
  designators of flipped components read normally, and top-side ones read mirrored. Notes always read
  normally. Text turns with the view; it is not kept upright.
- **Input** follows the screen: dragging to the right moves the board to the right, the wheel zooms
  around the cursor, and a click maps back to the board point under it. Snapping, hit-testing, the 8 px
  handle rule and the 3 px click threshold are unchanged because they are measured in screen pixels.
- **Directions**: `R` rotates a component 90° clockwise **as seen on the screen**, so seen from below it
  turns the other way in board space. The inspector's rotation, the ruler's Δx, Δy and angle, and the
  hover position stay as seen from the top. When the view is not "top, 0°", the ruler readout adds
  "(top view axes)".
- Fit to view (`Home`), Find (F14) and board check jumps (F16) fit in the current orientation; a
  quarter turn swaps the width and height to fit.
- Align mode works in any orientation. Its corner prompts name the board corners as seen from the top;
  when the view is not "top, 0°" the hint says so.
- View state: not saved, not undoable. Opening a project starts at top, 0°.
- Shortcuts: `B`, `.`, `,`.

## Non-functional requirements
- Smooth interaction (≥ 50 fps pan/zoom) with 2 × 24 MP images and 5 000 features on a mid-range laptop.
- Works in current Chrome, Edge and Firefox; keyboard- and mouse-driven; usable at 1366×768.
- No network access needed after load; no telemetry.
- Accessible UI controls (labels, focus states, sufficient contrast); dark theme default.

## Extension points (design for, don't build yet)
- `Tool` registry — new editing tools.
- Feature kind registry — new feature types with their own render, hit-test and serialization.
- Footprint library — JSON files / generator functions.
- `Exporter` interface — KiCad, Gerber, SVG, BOM exporters later (BOM planned in F13).
- `ImageAnalyzer` interface — future automatic via/trace detection.
- Board check rule registry (F16) — new checks are added as entries.
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

### Changes to existing behaviour
What M7–M18 change in what M0–M6 do (and, from M8 on, in what earlier planned milestones do), and which
existing tests must change with it.

| Milestone | Change | Existing tests that must change, and why |
| --- | --- | --- |
| M7 | Shift + letter becomes its own key combination (falling back to the plain letter when unbound). | `src/ui/shortcuts.test.tsx` "names key combinations with Ctrl and Shift, ignoring Alt" expects Shift+T to give `t`; it will give `Shift+t`. |
| M7 | Vias are placed on release, not on press; a click while the Via tool is armed places nothing. | `src/ui/shortcuts.test.tsx` "selects tools, toggles the grid, and undoes/redoes" sends only a pointerdown. `src/tools/placeSelect.test.ts` "place one feature per click with the current defaults and select it", "show a ghost under the cursor, snapped to the grid" and "runs the active tool generically" (it sends only a pointerdown to the Via tool) start in a fresh, armed session. `src/render/scene.test.ts` "outlines the selection and shows what the tool is doing" builds a via tool state without the new fields and expects a ghost with the armed default settings. E2E `tracing.spec.ts`, `nets.spec.ts` and `persistence.spec.ts` place vias by click; their first via must be drawn by drag, or the test must start with a known via size. `nets.spec.ts` also checks that the default 0.3 mm drill shows as 11.81 mil, which depends on that default. |
| M7 | The flat toolbar becomes grouped (Plane moves into Connections); groups without tools are hidden until their tool exists. | `e2e/shell.spec.ts` "fits 1366×768" must still pass (a check, not a rewrite; spacing may need tightening). |
| M8 | With exactly one via, hole or connection point selected, pressing on its handle resizes it instead of moving it (M3's Select tool moved it from any point on it). | None expected: `src/tools/placeSelect.test.ts` "drags selected features as a preview and moves them with one command on release" presses at the via's centre, and `src/render/scene.test.ts` "outlines the selection and shows what the tool is doing" (one via selected) checks only `scene.selection`, so both should pass unchanged if the handle is a separate scene field. Re-run them as checks. |
| M10 | Per-layer copper / silkscreen / notes toggles become object rows. Hidden features can no longer be selected or snapped to. Vias and holes get their own rows instead of following the active layer's toggles ([ADR 0007](adr/0007-footprints-components-planes.md)). | `src/ui/componentPanels.test.tsx` "shows and hides copper, silkscreen and notes per layer" (the toggles are gone). `src/render/featureScene.test.ts` "hides copper, silkscreen and notes per layer" and "reuses the result until the project, layer or visibility changes" (`hiddenContent` is replaced). |
| M12 | `Component` and its pads gain fields; project file version 4. | `src/core/io/fixtures.test.ts` gains the version 4 fixture, and the version 3 fixture must load as version 4. `src/ui/componentPanels.test.tsx` "edits designator, value and rotation, and rotates or flips" covers more fields. The builders in `src/core/model/features.test-support.ts` need the new fields. `src/core/io/projectFile.test.ts` follows `CURRENT_SCHEMA_VERSION` and should pass unchanged. |
| M13 | The flat Footprint list becomes the category picker; the default designator prefix comes from the part type. | `src/ui/componentPanels.test.tsx` "chooses a family, resets its parameters and prefix, and refuses out-of-range values". `src/tools/newTools.test.ts` "places the chosen footprint with the next designator, pads with fresh ids" (`settings.component` gains a part type). E2E `components.spec.ts` helper `chooseFootprint` selects from the old list. |
| M14 | `Exporter` gains a group; the Nets panel shows only netlist exporters; the side panel gets a third tab. | `src/core/export/exporters.test.ts`. `src/ui/netsPanel.test.tsx` "lists nets with members, filters them and exports" and "shows the nets tab and exports through the app". |
| M15 | `Ctrl+F` opens Find instead of the browser's find in page while the app has focus. | None: no test binds `Ctrl+F`; `src/ui/netsPanel.test.tsx` "opens the shortcuts help with ? or the button, and closes it with Esc" checks with `toContain`, so a new row does not break it. |
| M16 | `Shift+M` gets its own binding (Ruler) instead of falling back to `M` (Continuity, M11). | Any M11 test that presses `Shift+M` expecting Continuity. `src/ui/shortcuts.test.tsx` "runs the plain key for a Shift combination without a binding of its own" uses `Shift+t` and should pass unchanged. |
| M17 | The side panel gets a fourth tab (Check). The BOM's duplicate-designator rule (M14) moves into `core` so the board check can share it. | None expected: `src/ui/netsPanel.test.tsx` and `e2e/nets.spec.ts` find tabs by name. M14's duplicate-flag tests should pass unchanged after the move. Re-run `e2e/shell.spec.ts` "layout fits the minimum supported viewport (1366×768) without scrolling" as a check, because four tabs must fit in the panel. |
| M18 | The board ↔ screen mapping, which was only zoom + offset since M1, gains a mirror and quarter turns. The top view at 0° behaves exactly as before. Which way text reads now depends on the view as well as the side. | `Viewport` gains fields, so the tests that build a viewport literal must add them (or spread `DEFAULT_VIEWPORT`): `src/tools/navigation.test.ts` (the `view` constant), `src/app/importPhoto.test.ts` and `src/ui/useNavigation.test.tsx` "sends left clicks to the align tool in board coordinates; panning still works" (`updateView` with a literal viewport). `src/core/geometry/viewport.test.ts` should pass unchanged for the default orientation; its properties get extended to all eight orientations. `src/render/featureScene.test.ts` text tests and `src/render/scene.test.ts` "carries the viewport and the mirrored image transform" should pass unchanged, because the default view is top, 0°. Re-run `e2e/photos.spec.ts` as a check, because it reads rendered pixels to check mirroring. |

### Planned milestones
Same rules as above: one milestone per PR (reviewable in under an hour), passing CI, updated docs and a
short demo note. Ordered by dependency, then value: M7–M9 build on the via tool, M10 comes before M11
because probes respect visibility, and M12 → M13 → M14 go from fields to picker to BOM. M15 (Find)
needs M12's pin names and part fields and M10's object rows; M16 (Ruler) needs M11's Measure group. Both
are ready after M14, and Find comes first because it helps more on a large board.
M17 (Board check) reuses Find's jump (M15), the BOM's designator rule (M14) and pin names (M12), so it
comes after them. It comes before M18 because it serves the main goal, a correct netlist, directly.
M18 (View orientation) depends on nothing new. It comes last because it touches every board ↔ screen
conversion: landing it after Find, the Ruler and the board check lets their fit and readout rules be
checked in every orientation at once.

#### M7 — Tool groups, Shift shortcuts, via sizing
- **Status:** done ([ADR 0009](adr/0009-tool-groups-shift-shortcuts-via-sizing.md)).
- **Scope:** F7 without resize handles: grouped toolbar, Shift + key shortcuts, drawing a via to size,
  the armed state, `Shift+V`.
- **Done when:** the toolbar shows the groups; dragging from a via's centre sets its size and the default;
  later clicks place vias of that size; a fresh session starts armed; `Shift+V` arms again.
- **Tests:** unit: `comboOf` and the Shift fallback, the via tool state machine (click vs drag threshold,
  armed rules, drill ratio, clamps, `Esc`). Property: "a drawn pad is twice the drag distance, clamped".
  E2E: draw one via by drag, click two more, check their size in the inspector.
- **Schema:** no change.
- **ADR:** 0009 (tool groups, Shift combinations, via sizing).

#### M8 — Resize handles
- **Status:** done ([ADR 0009](adr/0009-tool-groups-shift-shortcuts-via-sizing.md), M8 section).
- **Scope:** F7 resize handles for vias, holes and connection points.
- **Done when:** dragging the handle of a selected via, hole or point resizes it as one undo step and
  updates the tool default; below 8 px on-screen radius no handle is shown and a press moves it.
- **Tests:** unit: select tool handle states, handle priority over features, clamps, the 8 px rule.
  Property: "undo after a resize restores the exact previous project". E2E: resize a via and undo.
- **Schema:** no change.
- **ADR:** amend 0009.

#### M9 — Landmarks from overlapping vias
- **Status:** done ([ADR 0010](adr/0010-landmarks-from-vias.md)).
- **Scope:** F9.
- **Done when:** placing a via over an existing one on the other photo offers a landmark; accepting adds
  one match, removes the new via and re-solves the alignment; undo brings back the previous state.
- **Tests:** unit: the overlap rule (sum of radii, 0.05 mm minimum, one photo only), mapping both centres
  to image pixels, the preference. Property: "a landmark from a perfectly aligned via pair has a
  residual of about 0". E2E: on the synthetic photos with a deliberately mis-aligned bottom, accepting
  landmarks lowers the RMS shown in the Align panel.
- **Schema:** no change (uses the existing matched points).
- **ADR:** 0010 (landmarks from vias, which photo each pixel comes from).

#### M10 — Object types panel
- **Scope:** F8.
- **Done when:** every object row hides or locks its type, per layer and for both-layer types; hidden
  features cannot be selected or snapped to; "Show all" restores everything.
- **Tests:** unit: view-state functions, scene filtering, select and snap filtering, selection pruning.
  Property: "hiding or locking object types never changes the nets". E2E: hide vias, then a click on a
  via selects nothing and a trace does not snap to it.
- **Schema:** no change (view state).
- **ADR:** 0011 (object types; supersedes the visibility part of ADR 0007).

#### M11 — Continuity check
- **Scope:** F10.
- **Done when:** two clicks report Connected or Not connected and highlight the path, including through
  vias; `Esc` clears; undo updates the result.
- **Tests:** unit: `connectionPath` and the result text. Property: "a path exists if and only if both
  anchors are in the same net", "consecutive features on a path share an anchor", "no shorter path
  exists than the one returned". E2E: probe pad A and pad C on the two-sided tracing board, then
  delete the via and see Not connected.
- **Schema:** no change.
- **ADR:** 0012 (connection graph and shortest path by feature count).

#### M12 — Component details
- **Scope:** F11: new component and pin fields, part type registry, designator rename, hover readout.
- **Done when:** every new field and pin name can be edited, saved and reloaded; changing the part type
  renames an automatic designator; hovering a pad shows its pin name and net.
- **Tests:** unit: part type registry, rename rule, the migration's inference table. Round-trip for a
  component with every field set. Fixture: `v3-example.json` loads as version 4; a new
  `v4-example.json` is committed. E2E: edit the fields and pin names, save, reopen, and check they are
  unchanged.
- **Schema:** **version 4**. Component gains `partType`, `description`, `manufacturer`, `partNumber` and
  `datasheet`; component pads gain `name`. Migration 3 → 4 infers `partType` as in F11 and sets the other
  fields to empty strings.
- **ADR:** 0013 (part types, component fields, file format version 4).

#### M13 — Categorised picker
- **Scope:** F12.
- **Done when:** a component can be placed through category → part type → footprint, with search and
  "All footprints"; the placed component carries that part type.
- **Tests:** unit: picker filtering, suggested-first ordering, a registry ↔ library consistency test.
  E2E: place an N-MOSFET on a SOT-23-3 footprint; it gets designator Q1 and that part type.
- **Schema:** no change.
- **ADR:** amend 0013.

#### M14 — Bill of materials
- **Scope:** F13.
- **Done when:** the Parts tab lists grouped lines that update with every edit and exports CSV and JSON.
- **Tests:** unit: grouping key, natural designator order, duplicate flag, CSV quoting, exporter groups.
  Property: "the quantities add up to the number of components". E2E: place parts, export the BOM CSV
  and check its rows.
- **Schema:** no change (the BOM is derived).
- **ADR:** 0014 (BOM grouping and exporter groups).

#### M15 — Find
- **Scope:** F14: find field, matching and ranking, result list with keyboard navigation, jump.
- **Done when:** `Ctrl+F`, a query and `Enter` select and frame a component or pin, or highlight and frame
  a net; `Esc` closes the field; a hidden result's row turns back on when jumped to.
- **Tests:** unit (core): the matcher and ranking (exact, word start, substring, natural order, 20-per-group
  limit, `U3.5` pin syntax), the fit-with-margin viewport and its 10 mm zoom cap. UI: typing in the field
  triggers no shortcuts, `↑`/`↓`/`Enter`/`Esc`. Property: "the fitted viewport contains the result's
  bounds", "every listed result contains the query, ignoring case". E2E: on the components board,
  find `U1`, jump, and check it is selected and its side is active; find a net by name and see it
  highlighted.
- **Schema:** no change.
- **ADR:** 0015 (find: what is searched, ranking, taking over `Ctrl+F`).

#### M16 — Ruler
- **Scope:** F15.
- **Done when:** two clicks show a length that matches the board (two pins of a 2.54 mm header read
  2.54 mm), `Shift` constrains to 45°, `Esc` clears, and the readout follows the display unit.
- **Tests:** unit: the ruler tool state machine (start, live, finished, restart on the next click, `Esc`),
  anchor and grid snapping, readout text in mm and mil. Property: "the length equals the distance
  between the ends", "with Shift the angle is a multiple of 45° and the length is the projection of the
  cursor onto that direction". E2E: measure between two header pads and check the status bar.
- **Schema:** no change.
- **ADR:** none (reuses trace snapping and `formatLength`); note the `Shift+M` binding in ADR 0009's
  list of Shift combinations.

#### M17 — Board check
- **Scope:** F16: the rule registry with the five starter rules, the Check tab with groups, counts and
  rule checkboxes, and jumping to a finding.
- **Done when:** on a board with an unconnected pin, an open trace end, a trace end lying on a pad it is
  not connected to, a lone via and a duplicate designator, the Check tab lists exactly one finding of
  each kind. Clicking a finding selects and frames its feature. Fixing it (or undoing) updates the list.
  On the 5 000-feature perf fixture (`pnpm perf`) one check takes under 100 ms.
- **Tests:** unit (core): each rule on small hand-made projects, including the edge cases in F16 (bound
  ends, two free ends at one point, a trace end on the middle of another trace's segment, a trace end
  on its own trace, trace end inside a plane, mechanical holes, a plane-attached pin), ordering, and
  the shared designator rule. UI: group checkboxes change the count; `Enter` on a row jumps; the label
  shows a count only while the tab is shown, and reopening the tab after an edit made on another tab
  shows the new count. Property: "connecting a reported open trace end to an anchor never adds a finding of the same
  rule", "no finding ever names a feature that is not in the project", "a project whose every anchor is
  in a net with another anchor has no Unconnected pin or Unused via findings". E2E: on the tracing
  board, delete the trace to pad C, see "Unconnected pin" in the Check tab, click it, and check that the
  component is selected; undo and see the finding go away.
- **Schema:** no change (findings are derived).
- **ADR:** 0016 (board check: rule registry, what counts as touching, computing only while shown).

#### M18 — View from below and rotation
- **Scope:** F17: the viewport as zoom + offset + mirror + quarter turns, rendering and input in every
  orientation, text readability, the header switch, `B` / `.` / `,`, the status bar indicator, and fitting
  in the current orientation.
- **Done when:** `B` shows the board from below with the bottom photo reading as in a photo taken from
  below. `.` and `,` turn the view in quarter turns about the centre. Clicking, snapping, dragging and
  wheel zoom land on the board point under the cursor in all eight orientations. Bottom silkscreen reads
  normally from below. `Home` fits a long board in a 90° view. `Tab` still only switches the layer.
- **Tests:** unit (core): orientation composition, `boardToScreen` / `screenToBoard`, `zoomAt`, `panBy`
  and `fitToRect` in every orientation; whether a text is mirrored per side and orientation; `R`'s
  board-space direction seen from below. Property: "`screenToBoard` inverts `boardToScreen` in all eight
  orientations", "`zoomAt` keeps the board point under the cursor fixed in every orientation", "four `.`
  presses, or `B` twice, give back the same viewport", "the fitted viewport contains the bounds in every
  orientation". E2E: on the synthetic photos, press `B` and check by reading pixels that a marker known
  to be on the left of the top photo is now on the right; place a via while seen from below and check
  its board position in the inspector.
- **Schema:** no change (view state).
- **ADR:** 0017 (view orientation: the viewport as a similarity transform, what stays in top-view axes,
  text readability rule).

## Backlog
Ideas that do not fit yet. Each needs a SPEC section and a milestone before work starts.

- Expected multimeter readings between two probes, computed from component values.
- Power and ground net roles: mark a net as Power or Ground for a fixed style, list it first, and carry
  the role into netlist exports (needs a file format change).
- A printable BOM (print stylesheet or PDF) next to the CSV and JSON exports.
- Scan the whole board for overlapping vias and suggest all landmarks at once.
- Pin names in netlist exports (changes the export format).
- Footprints for the new part types: SOD-123/323, SMA/SMB, SOT-223, SOT-89, DPAK, axial and radial
  through-hole, 3/5 mm LEDs, tactile switches, USB and JST connectors, HC-49 crystals. Best done right
  after M13.
- Resize handles for rectangular pads and for trace width.
- Automatic plane containment (already noted as a later enhancement).
- KiCad schematic / PCB export (a v1 non-goal).
- Board check, later: dismiss a single finding (saved in the project, so a file format change), a
  "Connect" quick fix for "Touching, not connected", more rules (a component pad overlapping copper of
  another net, an SMD pad on the wrong side), and exporting the findings.
- Saved views: store the current view (position, zoom, orientation, F17) in slots 1–9 and recall them
  with `1`…`9`. The key to store needs a decision: `Ctrl` + digit is taken by the browser's tab switching
  and zoom reset. Best done after M18.
- Editing conveniences: nudge the selection with the arrow keys (one grid step; `Shift` for ten), copy
  and paste with fresh ids that keep the connections inside the copied set, `Shift` while drawing a trace
  to constrain segments to 45° (as the Ruler does), and double-click on copper to select its whole net.
- Notes on a single feature and a project to-do list (a file format change).
- Overlay blink: alternate the two photos automatically at a set rate to spot misalignment.
- Board summary: counts per feature kind, nets, components and board check findings in one place.
- Print or PDF of the traced board, coloured by net (next to the printable BOM item above).
- Project history: restore an earlier autosave or save, beyond the undo history of the session.
- Datasheet import and automatic part identification: out of scope while the app must work without
  network access and send no data anywhere. The same applies to generated net names, circuit
  explanations and troubleshooting by a remote AI service.
