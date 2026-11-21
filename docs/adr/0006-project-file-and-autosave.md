# ADR 0006: Project file, schema versions and autosave

- **Status:** accepted
- **Date:** 2026-11-21

## Context

M4 adds persistence (SPEC F6): a single `.pcbrt` project file holding `project.json` and the
original photos, a `schemaVersion` with migrations for older files and a clear refusal of newer
ones, and autosave to browser storage with recovery on start. CLAUDE.md requires `Result` errors at
boundaries, derived data never stored, core free of browser APIs, a round-trip test per feature
kind and a fixture test per old schema version.

## Decision

**File layout.** A `.pcbrt` file is a zip (fflate) with:

- `project.json` — `{ "schemaVersion": 1, "project": { … } }`, deflated. `project` is exactly the
  model: board size, layers (photo metadata, mirror flag, corner clicks), matched points and features.
  Nets, net colours and alignment are recalculated on load. Undo history, view, selection and tool
  settings are not saved.
- `images/<imageId>.<ext>` — each photo's original bytes, **stored without compression** (they are
  already JPEG/PNG/WebP). Names come from image ids, so two photos named `top.jpg` never clash.

The app keeps each photo's original bytes next to its decoded tiles (about 5–10 MB per 24 MP JPEG)
so saving does not re-encode anything.

**Versions and migrations** (`core/io`). `parseProject` reads the version, refuses a newer one
(`future-version`, with a message to update the app), applies `MIGRATIONS[v-1 …]` in order and
validates the result against the current zod schema (precise error path), then checks references
(ties to missing anchors, matched points on missing layers). Every failure is a `LoadError` value;
nothing throws. Rules:

1. A released schema is never changed. A format change adds `schemaV<n+1>.ts`, one migration
   function and bumps `CURRENT_SCHEMA_VERSION`.
2. Every released version has a committed fixture under `src/core/io/fixtures/` that must keep loading.
3. zod strips unknown fields; a field the model needs must therefore be added through a new version.

**Opening.** The archive is unpacked and validated first; then photos are decoded with their saved
ids. A missing, unreadable or wrong-sized photo does not block opening: the project opens, the
status bar names the photo, and its corner clicks and matches stay (they refer to its pixels), so
importing it again restores the alignment. A photo that is in the file but cannot be shown keeps
its original bytes in the registry (with no tiles), so saving again never drops it from the file.

**Unpacking limits.** Files may come from anyone, so unpacking reads only `project.json` and
`images/*` and checks the sizes each entry declares before inflating it: at most 64 MiB for
`project.json`, 256 MiB per photo and 768 MiB in total, otherwise the file is refused as too large.
fflate inflates an entry into a buffer of exactly its declared size, so a zip bomb cannot grow past
these limits. Loading starts a fresh undo history and bumps the
project generation, so a slower import from the previous project is dropped.

**Saving** downloads `<name>.pcbrt` (works in every supported browser and is testable). Writing back
into the same file needs the Chromium-only File System Access API; that is left for the desktop
build. The store keeps `savedProject`; the project is "dirty" when it is a different object, so
undoing back to the saved state clears the marker for free (history keeps the same objects).

**Autosave** (`app/autosave.ts`) writes one slot to IndexedDB (idb-keyval; localStorage holds only
about 5 MB): `autosave` → `{ json, fileName, dirty, savedAt }`, plus `image:<id>` → original photo
bytes, each photo written once and removed when no longer used. It writes 1 s after the last change,
at once after a save to a file, and when the page is hidden. At start, recovery is offered **only if
the slot is dirty** (work never saved to a file). While the offer is open, autosave pauses so it
cannot overwrite that work; Restore loads it (still marked unsaved), Discard deletes the slot.

**Dependencies.** fflate 0.8 (MIT, small, sync API), zod 4 (MIT; one schema gives validation,
error paths and types), idb-keyval 6 (Apache-2.0, < 1 KB). Storage sits behind `KeyValueStore` in
`platform/`, so a desktop build can swap it.

## Consequences

- Files are self-contained and diff-friendly inside (`project.json` is indented JSON).
- Large photos make files large; that is the price of keeping the originals unchanged.
- Each save is a new download; the browser may append ` (1)` to the name.
- Autosave holds one project. Work in a second tab overwrites the first tab's slot.
- Adding a field to the model is a schema change: new version, migration and fixture.
