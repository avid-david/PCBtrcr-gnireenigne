# ADR 0003: Displaying photos — tiling, on-demand rendering and the layer overlay

- **Status:** accepted
- **Date:** 2026-11-21

## Context

SPEC F1 requires two photos of at least 24 MP each, panned and zoomed at ≥ 50 fps on a mid-range laptop,
with the inactive layer shown as an adjustable overlay. WebGL caps texture size (commonly 8192 or 16384
px per side), and a decoded 24 MP photo needs ~96 MB of memory.

## Decision

**Decoding and tiling** (`platform/`)
- Photos are decoded with `createImageBitmap` and cut into tiles of at most **4096 px**
  (`core/geometry/tiling.ts`). The WebGL 2 minimum is 2048, but practically every desktop and laptop GPU
  supports at least 8192, so 4096 leaves headroom without querying the GPU. The full-size bitmap is
  released after tiling.
- Accepted types are PNG, JPEG and WebP; photos above **100 MP** are refused with a message. Failures are
  returned as `Result`, never thrown.
- Decoded pixels live in an image registry in `app/`, keyed by image id — **not** in the model, which stays
  plain serializable data. Pixels of photos the project no longer references are released immediately.

**Rendering** (`render/`)
- The rest of the app depends on the `Renderer` interface only. `buildScene` (pure, unit-tested) turns
  project + view state into a list of photos with transforms and opacities.
- The PixiJS v8 implementation renders **on demand**: the ticker is stopped, and the app schedules at most
  one `render()` per animation frame, only after the project or view changed. Idle cost is zero.
- PixiJS is loaded as a separate chunk via dynamic `import()`, so the shell appears before the renderer
  has downloaded.
- `preserveDrawingBuffer` is on so e2e tests can read rendered pixels.

**Overlay and interaction** (decided with the project owner for M1)
- The active layer is drawn opaque at the back, other layers on top at the overlay opacity (default 50 %).
- **No tint** for the overlay. The SPEC's "optional tint" is dropped; it can return later as its own change.
- **`Tab` always switches layers**, including when a control has focus. This deliberately replaces the
  browser's Tab focus navigation inside the app; controls stay reachable by mouse and remain labelled.
- `Home` fits all photos into the view (`F` is reserved for "flip component" in M5).

**Testing**
- `src/render/pixi/**`, `src/platform/browserImage.ts` and `src/app/main.tsx` need a real browser (WebGL,
  `createImageBitmap`, DOM mounting) and are excluded from unit-test coverage. Playwright e2e tests cover
  them by reading rendered pixels (mirroring, overlay blending, layer switch, hiding photos).

## Consequences

- Measured on the development machine (100 Hz display, two 6000 × 4000 photos): pan and wheel-zoom run
  at the full 100 fps (p95 frame 10.3 ms, worst 10.9 ms); importing a 24 MP JPEG takes ~0.3 s. No seam
  is visible across tile boundaries at maximum zoom. A "mid-range laptop" has not been measured.
- Keyboard-only users cannot move focus with `Tab`; revisit if accessibility requirements change.
- Swapping PixiJS for another renderer touches only `src/render/pixi/` and the factory in `app/main.tsx`.
