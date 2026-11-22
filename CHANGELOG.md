# Changelog

All notable changes to PCB Reverse Tracer. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow
[Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- **Tool groups, Shift shortcuts, via sizing (M7):** the toolbar shows tools in labelled groups;
  `Shift` + key shortcuts (falling back to the plain key); draw a via to size by dragging from its
  centre to its edge, after which clicks place vias of that size; `Shift+V` draws the next via to
  size.

### Changed

- Vias are placed when the mouse button is released, and the first via of a session is drawn to
  size (a click places nothing until a via size is known).
- Plane moved into the Connections group, before Component, in the toolbar.

## [0.1.0] - 2026-11-22

The first release: every feature in the SPEC's v1 scope.

### Added

- **Photos (M1):** import top and bottom photos (PNG, JPEG, WebP, up to 100 MP), pan, zoom,
  fit to view, switch layers with `Tab`, mirror the bottom photo, overlay opacity.
- **Alignment (M2):** set the board size, click its corners, match vias across photos; perspective
  alignment with per-point error, RMS and outlier marking; photos warped on the GPU.
- **Tracing (M3):** traces, vias, pads, connection points and holes; anchors and snapping; nets
  derived automatically and coloured consistently; unlimited undo and redo.
- **Projects (M4):** save and open `.pcbrt` files (project plus original photos) with versioned,
  migrated file formats; autosave in the browser with recovery on start.
- **Components (M5):** a footprint library (pin headers, chips 0201–2512, SOIC, TSSOP, DIP,
  SOT-23, TO-92, TO-220, a pad grid); place, rotate and flip components; planes with explicitly
  attached anchors; silkscreen lines and text; notes; per-layer copper, silkscreen and notes
  visibility.
- **Nets (M6):** a nets panel to rename, recolour, lock and highlight nets; names and colours that
  follow nets through edits (the larger net wins a merge); netlist export as JSON and CSV;
  mm or mil display units; a keyboard shortcuts overlay (`?`).

[0.1.0]: https://github.com/avid-david/PCBtrcr-gnireenigne/releases/tag/v0.1.0
