# ADR 0010: Landmarks from overlapping vias

- **Status:** accepted
- **Date:** 2026-11-22

## Context

M9 (SPEC F9). A via is one object on both layers. When the photos are not quite aligned, the user
sees the same hole in two places on the board, and often places a second via on the "other" hole
next to the first one. That pair is an alignment landmark the user has already clicked, so the tool
offers to turn it into a matched point. The project stores matched points as image pixels per
layer (`PointMatch`, [ADR 0004](0004-alignment.md)), while vias live in board mm. Pixels may only be
computed in `core/alignment`, and every edit must be one undoable command
([ADR 0005](0005-features-connectivity-undo.md)).

## Decision

**Overlap rule** (`core/alignment/landmarks.ts`, `viasOverlap`). Two vias overlap when their
centres are closer than the sum of the pad radii, and at least `LANDMARK_MIN_OFFSET_MM` = 0.05 mm
apart. Closer centres carry no information about the alignment, so they give no offer.
`findLandmark` offers the nearest overlapping via. It does so only when the active layer and some
other layer both have a photo; with more than two layers, the first other layer with a photo in
list order is used. Visibility and net locks are ignored: accepting never changes the existing via.

**Which photo each pixel comes from** (`landmarkPixels`):

| Side of the match | Pixel |
| --- | --- |
| The **other** layer | The **existing** via's centre, mapped board → image through the other layer's current transform. |
| The **active** layer | The **new** via's centre, mapped board → image through the active layer's current transform. |

A layer's "current transform" is what `layerTransform` gives: its alignment, or its unaligned
placement while it has too few points. The new via was placed while its photo was on screen, so it
sits on the hole as that photo shows it. **We assume the existing via was placed against the other
photo.** The tool cannot know that. When the assumption is wrong (for example, both vias were placed
on the same photo), the match is wrong too, and it shows up like any bad click: as a large residual
or an outlier in the Align panel, where it can be deleted.

**Accepting** is one command, `addLandmarkFromVias` (`core/commands/landmarks.ts`). It computes the
pixels from the project it is given, removes the new via (with `removeFeatures`, so nothing that
might be tied to it is left dangling) and appends the match. It is one undo step, and undo restores
the exact previous project (property test). The alignment is derived from the matches, so it is
solved again without any extra step. The existing via keeps its board position. The command changes
nothing if a via of the offer is gone.

**Where the offer lives.**
- The Via tool asks `findLandmark` when it places a via and returns the offer in the new optional
  `ToolResult.landmark`. The store keeps it as transient editor state (`EditorData.landmarkOffer`),
  not in the via tool's own state. That way it survives tool switches and view changes, and the
  status bar can read it whichever tool is active.
- The offer refers to the project right after the placement. So any edit (any command that changes
  the project), undo and redo, `Esc`, **Keep both**, a new or opened project, and the next via all
  withdraw it. The next via replaces it, so there is only ever one offer.
- The status bar shows "Overlaps via at (x, y) — same via?" in the display unit, with **Use as
  landmark** and **Keep both** buttons.

**Preference.** `ToolSettings.offerLandmarks` (on by default) is set by the Align panel checkbox
"Offer landmarks from overlapping vias". `app/landmarkPreference.ts` remembers it per browser
(key `pcb-reverse-tracer.offer-landmarks`), like the display unit. It is not saved with the project.

## Consequences

- No file format change: a landmark is an ordinary matched point. It has a residual, can be flagged
  as an outlier, and can be deleted in the Align panel.
- Adding good points does not always lower the RMS right away: with few points the fit partly
  absorbs a bad point's error, and new points take that slack away. The e2e test therefore uses a
  set-up where it does go down (exact corners plus two deliberately wrong matches: 0.774 →
  0.678 mm after two landmarks), and the property test checks residuals instead.
- `ToolResult` gains a second optional, tool-specific field (after `settings`). If more tools
  need such side channels, they should become a small registry of result effects instead.
- M10 (object types) must keep ignoring visibility here: SPEC F9 says a hidden existing via still
  gives an offer.
