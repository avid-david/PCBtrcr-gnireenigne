# ADR 0009: Tool groups, Shift combinations and drawing vias to size

- **Status:** accepted. Supersedes two points in the **Tools** part of
  [ADR 0005](0005-features-connectivity-undo.md): a tool is no longer bound only to a single key,
  and the Via tool no longer places a via on press.
- **Date:** 2026-11-22

## Context

M7 (SPEC F7) groups the toolbar, adds Shift + key shortcuts, and lets the user draw the first via
to the size of the hole in the photo instead of typing a diameter. Until then every tool placed its
feature on `pointerdown` with sizes from the tool settings. Tools are pure state machines that cannot
change the settings themselves (ADR 0005), and they did not know the zoom or the display unit.

## Decision

**Groups.** Every `Tool` declares a `group` (`select`, `connections`, `components`, `annotations`,
`measure`, `align`). `TOOL_GROUPS` in `tools/tool.ts` gives their order and captions.
`toolbarGroups()` in the registry lists the registered tools per group and leaves out groups that
have no tools. That is why Measure appears only once the Continuity tool (M11) is registered. The
toolbar draws each group as a `role="group"` with a small caption, separated by rules. The toolbar
column grew from 48 to 64 px so the captions fit; the layout still fits 1366×768. Plane moved into
Connections, so the toolbar order is now Select · Trace, Via, Pad, Point, Hole, Plane · Component ·
Silkscreen, Text · Align.

**Shift combinations.** `comboOf` names Shift on its own: `Shift+v`, `Shift+Tab`, `Ctrl+Shift+z`.
`runShortcut` looks the combination up, and when it is unbound it retries without the leading
`Shift+`. That holds for every key, not only letters, so `Shift+Tab` still switches layers and `?`
still opens the help as before. Ctrl combinations do not fall back.

**Via tool.** It has its own state machine (`tools/via.ts`, state `{ cursor, drag, armed }`), with
the size rules in `tools/viaSize.ts`.

- The centre is the grid-snapped press point; nothing is placed until release.
- A press and release within `CLICK_PX` = 3 screen px is a click. A drag that once went further is
  a drag even if it ends back on the centre, which gives the minimum size.
- To convert screen px, a tool uses `hitRadiusMm / HIT_RADIUS_PX` from the pointer event. For that,
  `HIT_RADIUS_PX` moved from `ui/toolInput.ts` to `tools/tool.ts`, and the event types are unchanged.
- **Drawn size:**
  - The pad is 2 × the drag distance, clamped to 0.1–10 mm and not snapped.
  - The drill is pad × (default drill ÷ default pad) in whole hundredths of a mm, clamped to
    0.01 mm … the largest hundredth below the pad. A 0.1 mm pad therefore has at most a 0.09 mm drill.
- **Armed:** the tool is armed when `state.armed || !settings.viaSizeKnown`. While armed, a click
  places nothing and no ghost is shown, because a via ghost would suggest that a click places one.
- **Shift+V** selects the Via tool (without the usual toggle back to Select) and sends it the key
  `Shift+v`, which sets `armed`.
- **Esc:** drops a drag. With no drag, it clears `armed`, but the tool stays armed while no size is
  known.
- **Layer switch:** the drag records the active layer at press. A move or release on another layer
  drops the drag, so Tab interrupts it.
- The hint shows the diameter in the display unit. `LengthUnit` and `formatLength` moved to
  `core/view/units.ts` (re-exported by `ui/units.ts`), and `ToolContext` gained `units`.

**Size known.** `ToolSettings.viaSizeKnown` is session state, not saved, and false at start.
`rememberDefaults` sets it for a via, which covers both inspector paths: editing a via and editing
the via defaults. A tool can return new defaults in the optional `ToolResult.settings`, and
`sendToTool` applies them. A drawn via does this, while a click at the current size does not.
`store.loadProject` (open and autosave restore) runs `adoptNewestViaSize`, which takes the last via
in `project.features` as the newest, because features are appended when created. A new project keeps
the session's settings.

## Consequences

- Placing the first via of a session takes a drag. Tests that click vias must first draw one, edit
  the via defaults, or load a project with vias.
- Other tools can return new defaults the same way, for example the resize handles in M8.
- A future tool joins a group by declaring it, with no toolbar change. A new group needs an entry
  in `TOOL_GROUPS`.
- Pad, point, hole and text tools still place on press. Only the Via tool distinguishes a click
  from a drag.

## Amendment for M8: resize handles (2026-11-22)

This section adds to the decisions above and changes none of them.

**Context.** SPEC F7 gives the Select tool a handle on the edge of a selected via, hole or
connection point, so a size can be corrected after it was placed. On a small via at low zoom, an
edge handle would cover the via's centre and steal the press that should move it.

**Decision.**
- `tools/resizeHandle.ts` holds the handle rules and a registry keyed by feature kind (`via`,
  `hole`, `point`), each entry giving the radius and how the feature is resized. A new resizable
  kind is one more entry. The `editable` rule (active layer, not in a locked net) moved there from
  `select.ts`, so selecting and resizing cannot disagree.
- A handle exists when exactly one resizable, editable feature is selected. It sits on the +x
  edge, `centre + (radius, 0)`. It is shown only while the on-screen radius is at least
  `HANDLE_MIN_RADIUS_PX` = 8. A press within `HANDLE_HIT_PX` = 5 px grabs it; the dot is drawn
  with `HANDLE_DRAW_PX` = 4. Because 5 < 8, a press on the centre never grabs the handle.
- The handle wins over feature hits, with or without Shift.
- The Select tool gains the state `resizing` (`id`, `centre`, `press`, `clickMm`, `layerId`,
  `radiusMm`). The radius is the distance from the centre to the pointer and stays `null` until the
  pointer has moved more than `CLICK_PX` = 3 px, so a press and release on the handle edits nothing.
  Screen px become mm through `hitRadiusMm / HIT_RADIUS_PX`, as for the Via tool.
- **Sizes.** A via is resized with `drawnViaSize`, called with the via's own size, so it keeps its
  own drill-to-pad ratio, clamped and rounded as when it is drawn. Holes and points get
  diameter = 2 × radius through `clampDiameter` (0.1–10 mm, the via pad range), without rounding.
- **Release.** One `updateFeature` command (one undo step) and `rememberDefaults` in
  `ToolResult.settings`, which, for a via, also sets `viaSizeKnown`. `Esc` drops the drag. So do a
  layer switch, the feature being deleted, and the feature no longer being editable.
- **Drawing.** `Scene.handle` (board mm or `null`) is computed only for the Select tool from the
  preview project, with mm per px = 1 / zoom. While a handle is dragged it stays visible below
  8 px. The overlay layer draws it as a white dot with a dark ring, constant on screen. The hint
  shows the live diameter in the display unit.

**Consequences.**
- No file format change; the resize is an ordinary feature edit.
- Rectangular pads and trace width have no handle yet (Backlog); they would need their own entries
  and a handle shape that is not round.
- Pressing exactly on a selected via's right edge now resizes it instead of moving it. Moving from
  the centre is unchanged.
