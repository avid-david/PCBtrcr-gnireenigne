# ADR 0008: Net names, colours and locks; netlist exporters

- **Status:** accepted
- **Date:** 2026-11-21

## Context

M6 adds the nets panel (SPEC F5): rename, recolour and lock nets, highlight one across both
layers, and export the netlist as JSON and CSV. Nets are derived, never stored (CLAUDE.md), so a
name or colour the user gives a net must be stored against something that survives edits. The
SPEC asks for a documented rule: "overrides are stored against a member anchor so they survive
net merges/splits predictably", and "merging two nets keeps the name/colour of the larger net;
the UI shows a short notice".

## Decision

**Net styles.** `Project.netStyles` lists `{ anchor, name, color, locked }`; `null` keeps the
automatic name ("Net 7", numbered by the net's oldest anchor) or colour (hashed from the net id,
ADR 0005). A style is stored on the net's **most durable member**: a component pad, else a pad,
point, via or plated hole, else a trace point (traces come and go while tracing). Setting all of
name, colour and lock back to automatic removes the style.

**Reconciling after every edit** (`reconcileNetStyles`, applied to every command in the same undo
step, so undo restores the styles exactly):

1. A style whose anchor was deleted moves to the most durable surviving member of the net it was
   in before the edit; if nothing of that net survives, the style goes with it.
2. When an edit leaves several styles in one net (nets merged), the style of the net that was
   **larger before the edit** (more anchors) stays and the others are dropped. The status bar says
   "Joined SMALL into BIG (the larger net keeps its name and colour)". A styled net joining an
   unstyled one simply keeps its style; there is nothing to drop and no notice, because unnamed
   nets merge constantly while tracing.
3. When a net splits, its style stays with the part that holds its anchor; the other part is
   automatic again.

**Lock.** Features touching a locked net (any of their anchors, or a plane's attached anchors)
cannot be selected, so they cannot be moved or deleted. Traces can still be drawn to them, and the
net can still be renamed, recoloured and unlocked.

**Highlight** is view state (`view.highlight`, a member anchor), not saved: the highlighted net is
drawn at full strength on every layer, everything else faint, component pads one by one.

**Exporters.** `core/export` has an `Exporter` registry (SPEC extension point) with `netlist-json`
and `netlist-csv`. Members are component pins as `R1.2` (`?` for an empty designator) and other
anchors as `kind:id` (`via:…`, `pad:…`, `point:…`, `hole:…`); trace points are left out, and nets
with only trace points are skipped. Nets are sorted by name (numbers naturally). CSV is RFC 4180
(`net,member` rows, quoted where needed, CRLF).

**File format version 3** adds `netStyles` (the 2 → 3 migration adds an empty list); loading
refuses styles on missing anchors. A version 3 example file is committed next to versions 1 and 2.

**Display units** (SPEC: mm or mil) are a per-browser preference, not project data: lengths are
stored in mm, shown and typed in the chosen unit, and a typed suffix (`10mil`, `0.25 mm`) wins.

## Consequences

- Names and colours survive moving, re-tracing and deleting parts of a net, and merges are
  predictable and announced.
- Automatic names ("Net 7") change when nets merge; rename the nets that matter before exporting.
- Performance, measured with `pnpm perf` (headed Chromium, Intel UHD Graphics integrated GPU, two
  24 MP photos, 5000 features): panning at 100 fps (median frame 10.0 ms, p95 10.1 ms), above the
  SPEC's 50 fps target. This closes the GPU check left open in ADR 0005.
