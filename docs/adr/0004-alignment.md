# ADR 0004: Photo alignment — inputs, solver, outlier test and GPU warp

- **Status:** accepted
- **Date:** 2026-11-21

## Context

SPEC F2 asks for perspective alignment of both photos: a board outline step (size + 4 corners on
the top photo), matched points between photos, a homography per photo (normalised DLT, least
squares beyond 4 points), per-point residuals and RMS in mm with outliers highlighted, a cached
warp computed in a Web Worker, and a live preview while dragging. M2 is done when two photos align
to < 0.2 mm RMS with 6 good points.

## Decision

**What is stored.** The project stores only user input: board size, corner clicks per layer and
matched features (`PointMatch`: one image-pixel position per layer). Homographies, residuals and
outlier flags are derived (`core/alignment`) and cached per immutable project object, never saved.
Replacing a photo drops the points clicked on it.

**Who is aligned to what.** Layers are aligned in list order. A layer uses its own board corners
(board positions are known once the size is set) and its matches with layers aligned before it,
mapped through that layer's transform. The top layer is therefore fixed by its 4 corners; the bottom
by matches and/or its own corners. This extends to more layers without changes.

**Solver.** Normalised DLT (Hartley) on the 9×9 normal matrix, using our own cyclic Jacobi
eigen-solver (~90 lines) instead of a linear-algebra dependency, then 5 Gauss–Newton steps that
minimise the geometric error in board mm (the DLT alone minimises an algebraic error). Fewer than 4
points and degenerate layouts (collinear, coincident) return a `Result` error.

**Outliers.** The agreed rule "residual > 2.5 × RMS and > 0.1 mm" turned out to be unusable: with
n points no residual can exceed √n × RMS (2.45 for 6 points), and the fit bends towards a bad
point, so even leave-one-out blames good points. We use the standard regression diagnostic instead:
externally studentized residuals with the full 2×2 leverage block per point, tested against the
exact F(2, ν) quantile (closed form; ν = 2n − 10) with a 1 % false-alarm budget shared by all
points; points closer than 0.1 mm to the fit are never flagged. Points are flagged one at a time,
refitting without each flagged point, because one large mis-click otherwise inflates the test for
the others. Simulated performance (2000 click sets per row, lens distortion, ±1 px clicks):

| Points | False alarms | 0.5 mm mis-click found | 1 mm | 2 mm |
| --- | --- | --- | --- | --- |
| 6 | 0 % | 45 % | 75 % | 98 % |
| 7 | 0 % | 96 % | 100 % | 100 % |
| 8+ | 0 % | 100 % | 100 % | 100 % |

Fewer than 6 points cannot be judged (no degrees of freedom left without the point). Two
simultaneous mis-clicks can mask each other; the RMS still shows the problem and fixing one reveals
the other.

**Warping on the GPU instead of a cached warp in a Web Worker** (deviation from SPEC F2, agreed
before implementation). Each 4096 px tile is a PixiJS `PerspectiveMesh` with 33 × 33 vertices
whose corners follow the alignment. Vertices are placed exactly by the projective map; within a
cell the GPU interpolates linearly. A unit test bounds that error below 0.1 photo pixel for
hand-held perspective; without subdivision it would exceed one pixel. This needs no warped copy
(saving ~96 MB per 24 MP photo), updates instantly, and makes the live preview free. Tiles that
the transform's horizon crosses (possible in a wild preview) are skipped instead of drawn folded.

**Live preview.** While a point is dragged, the align tool keeps the dragged position in its
(transient) state; the canvas and the panel render `previewProject`, one shared object per drag
step so the alignment is solved once. The cursor is mapped to image pixels with the transform
frozen at drag start, so the point does not run away as the alignment changes under it.

## Consequences

- **Acceptance:** a property test with synthetic photos (perspective, barrel distortion of ~3 px a
  homography cannot model, ±1 px click error, 4 corners + 6 matches) requires reported RMS and the
  true error at 35 independent check points to stay < 0.2 mm over 100 random click sets; observed
  worst case 0.035 mm. An e2e test clicks blobs on rendered synthetic photos through the real UI and
  gets 0.038 mm RMS. No real photos were available; real phone photos with strong lens distortion
  may not reach 0.2 mm, because a homography cannot correct distortion.
- **Performance (dev machine, 100 Hz display, two 24 MP photos, production build):** pan and zoom
  hold 100 fps. A full alignment solve with the outlier test takes ~1.8 ms; main-thread work per
  drag move is ~0.3 ms, and drags often run at a steady 100 fps. Some drag runs showed intermittent
  170–340 ms stalls that never appeared on the main thread (no long animation frames); their cause
  was not identified in this environment and should be checked with a DevTools GPU trace on a
  mid-range laptop.
- Mirroring only affects unaligned photos; the Mirror checkbox is disabled once a layer is aligned.
- SPEC F2 is updated to describe the GPU warp.
