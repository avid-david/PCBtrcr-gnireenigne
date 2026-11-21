# ADR 0005: Copper features, connectivity, net colours, undo and tools

- **Status:** accepted
- **Date:** 2026-11-21

## Context

M3 adds the editing core: traces, vias, holes, pads and connection points (SPEC F3), explicit
connectivity with one colour per net (SPEC "Connectivity"), unlimited undo/redo, and a tool per
editing action. CLAUDE.md requires commands for every edit, derived data never stored, registries
instead of `switch` statements, and property tests for connectivity and undo.

## Decision

**Features and ties.** Features are plain data in `Project.features` (drawing order = age). A
trace vertex is either `free` (own position) or `bound` to an anchor id (pad, via, plated hole,
point or another trace vertex) and then has **no position of its own**: it always sits on its
anchor. Moving a pad drags its traces; deleting it frees the tied vertices where they were. A
vertex snapped onto a bound vertex ties to that vertex's root anchor, so there are no chains.
Per-kind behaviour (layers, anchors, bounds, hit-testing, moving) lives in registries
(`core/model/featureKinds.ts`, `anchors.ts`); drawing (`render/pixi/featureDrawing.ts`) and
inspector fields (`ui/featureFields.ts`) have their own registries.

**Connectivity.** Nets are derived by union-find (`core/connectivity/nets.ts`), cached per
immutable project: a trace joins its vertices, a bound vertex joins its anchor. Vias, plated holes
and through-hole pads are single anchors on every layer, so they join top and bottom.

**Net identity and colour.** A net is named by its **oldest anchor** (first in drawing order).
Its colour is a hash of that id spread over hues by the golden ratio, at fixed saturation and
lightness. Colours therefore never shuffle when unrelated features change and nothing is stored.
When two nets merge, the older one keeps its colour, which is usually the larger. The SPEC's
"larger net keeps name/colour" applies to user-set names and colours, which arrive with the nets
panel (M6) and are stored against a member anchor.

**Undo by snapshots.** Commands stay pure `execute(project) → project` functions. The history
keeps the project before each step (`core/commands/history.ts`); undo restores it exactly and
redo re-applies the next. Because every command returns a new project that shares all unchanged
parts with the old one, a snapshot costs only the changed path. No hand-written inverse per
command means no inverse can be subtly wrong; "undo after execute restores the exact previous
state" is a property test. Commands that change nothing return the same project and add no step.

**Photos and undo.** Undoing a photo import must bring the old photo back, so decoded pixels are
kept while the project **or any undo/redo step** references them, and freed once none does
(e.g. new project). Cost: ~96 MB per replaced 24 MP photo for the session.

**Tools.** A `Tool` is a pure state machine (`step`, `hint`, `preview`, `overlay`) registered in
`tools/registry.ts` with its toolbar label and shortcut: Select `S`, Trace `T`, Via `V`, Pad `P`,
Connection point `C`, Hole `H`, Align `A` (align mode became a tool). Events dispatch through
per-tool handler tables. Navigation (middle/space drag, wheel) gets every event first and works
with every tool. Snapping: anchors within 10 screen px on the active layer or all layers, else
the optional grid (`G`, default 0.5 mm). Pads, vias, points and holes win over traces when
clicking, since trace ends usually lie on them. Sizes for new features come from tool settings;
editing a feature in the inspector makes its sizes the new defaults.

**Rendering.** Copper is drawn in board mm by a PixiJS `Graphics` that is rebuilt only when the
feature list changes (after an edit or a layer switch); panning and zooming only move the
container. Inactive-layer features are drawn first at 30 % opacity and are not editable.

## Consequences

- **Performance (5000 features).** Measured in headless Chromium, which renders in software:
  two 24 MP photos alone pan at 60 fps (the headless cap), 5000 features alone at 58 fps, both
  together at 42–45 fps (p95 33 ms). The combined case is fill-rate bound in software; on a GPU
  the photos alone ran at 100 fps (ADR 0003), but the combined case has **not yet been measured on
  a GPU**. The SPEC's ≥ 50 fps target needs that check on a mid-range laptop; if it fails, the
  next step is caching the copper layer as a texture per zoom level.
- Placing 7500 edits took 6.4 s in total (< 1 ms each); the history copies its arrays per step,
  which is fine for interactive use.
- Unfinished tool work (a half-drawn trace) restarts after undo/redo, since it refers to the
  project as it was.
- Saving (M4) must serialize features and ties; nets, colours and history are not saved.
