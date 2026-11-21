# ADR 0002: Coordinate conventions and image transforms

- **Status:** accepted
- **Date:** 2026-11-21

## Context

Every later feature (alignment, tracing, connectivity, export) depends on one shared coordinate system.
Photos have their own pixel coordinates, the bottom photo is taken from below, and before M2 there is no
alignment at all — yet M1 must already show both photos in a common space so they can be overlaid.

## Decision

- **Board space** is in millimetres, origin at the top-left, x to the right, **y down**, viewed from the
  top side (SPEC glossary). y-down matches image and screen conventions, so no flips are needed between
  them; exporters that need y-up (e.g. Gerber) convert at the boundary.
- **Screen space** is CSS pixels: `screen = board · zoom + offset` (`core/geometry/viewport.ts`). Zoom is
  screen pixels per mm, clamped to 0.05–200.
- Every photo has an **image → board transform**, a 3×3 matrix (`core/geometry/mat3.ts`, row-major,
  column vectors, projective divide on apply). M1 only produces affine matrices; M2 fills the third row
  with a homography without changing any types.
- **Mirroring** of the bottom photo is part of that transform (`x' = width − x` in image pixels), never a
  pixel edit. The model stores only `mirrored: boolean`; the transform is derived from it.
- **Before alignment** (M1), each photo is scaled to a nominal **100 mm width**
  (`core/alignment/initialPlacement.ts`). Photos of the same board taken at a similar framing therefore
  roughly overlap. M2 replaces this with the computed alignment.
- Image pixels are converted to mm **only** in `core/alignment/`. Everything else works in board space.
- Composition order: `compose(f, g)` applies `f` first, then `g` (left-to-right reading order), while
  `multiply(a, b)` is the mathematical product `a · b` (applies `b` first).

## Consequences

- Renderers receive one matrix per photo and need no knowledge of mirroring or alignment.
- Board-space numbers are meaningless until M2's board outline step sets the real scale; the 100 mm width
  is a placeholder the UI does not present as a measurement.
- Projective (non-affine) transforms cannot be drawn by a plain sprite transform; M2 will render warped
  photos from a cached warp (SPEC F2), not by passing a homography to the renderer.
