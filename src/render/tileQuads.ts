import { apply, type Mat3 } from '../core/geometry/mat3';
import type { PixelRect } from '../core/geometry/tiling';
import type { Vec2 } from '../core/geometry/vec2';

/**
 * Grid vertices per side of each tile mesh. Vertices are placed exactly by the projective
 * mapping; inside each cell the GPU interpolates linearly. 33 (32 × 32 cells per tile) keeps
 * that error below 0.1 photo pixel for hand-held perspective (tileQuads.test.ts), at ~2k
 * triangles per tile.
 */
export const MESH_VERTICES = 33;

/** Board positions of a tile's corners, clockwise from top-left. */
export function tileCorners(imageToBoard: Mat3, rect: PixelRect): [Vec2, Vec2, Vec2, Vec2] {
  const right = rect.x + rect.width;
  const bottom = rect.y + rect.height;
  return [
    apply(imageToBoard, { x: rect.x, y: rect.y }),
    apply(imageToBoard, { x: right, y: rect.y }),
    apply(imageToBoard, { x: right, y: bottom }),
    apply(imageToBoard, { x: rect.x, y: bottom }),
  ];
}

/**
 * Whether the transform's horizon (projective divisor = 0) stays clear of the tile. The divisor
 * is linear in x and y, so the tile is clear exactly when it has the same, non-zero sign at all
 * 4 corners. Its sign itself means nothing (a homography is only defined up to scale, including
 * −1). A tile the horizon crosses has points that flip through infinity (possible in a wild
 * preview while dragging a point); it is skipped rather than drawn as huge folded triangles.
 */
export function isTileDrawable(imageToBoard: Mat3, rect: PixelRect): boolean {
  const divisor = (x: number, y: number) =>
    imageToBoard[6] * x + imageToBoard[7] * y + imageToBoard[8];
  const xs = [rect.x, rect.x + rect.width];
  const ys = [rect.y, rect.y + rect.height];
  const signs = xs.flatMap((x) => ys.map((y) => Math.sign(divisor(x, y))));
  return signs.every((s) => s === 1) || signs.every((s) => s === -1);
}

/** The corners as the flat list `setCorners` expects. */
export const flatCorners = (corners: readonly Vec2[]): number[] =>
  corners.flatMap((c) => [c.x, c.y]);
