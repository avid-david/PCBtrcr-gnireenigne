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

/** The corners as the flat list `setCorners` expects. */
export const flatCorners = (corners: readonly Vec2[]): number[] =>
  corners.flatMap((c) => [c.x, c.y]);
