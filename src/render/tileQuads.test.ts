import { describe, expect, it } from 'vitest';
import { BOTTOM_TRUTH, TOP_TRUTH, pixelsToBoard } from '../core/alignment/fixtures.test-support';
import { apply, type Mat3 } from '../core/geometry/mat3';
import type { PixelRect } from '../core/geometry/tiling';
import type { Vec2 } from '../core/geometry/vec2';
import { MESH_VERTICES, flatCorners, isTileDrawable, tileCorners } from './tileQuads';

/**
 * Largest distance (mm) between the exact projective mapping and the mesh: grid vertices are
 * mapped exactly, points inside each triangle are interpolated linearly between them.
 */
function meshErrorMm(h: Mat3, rect: PixelRect, vertices: number): number {
  const cells = vertices - 1;
  const at = (i: number, j: number): Vec2 => ({
    x: rect.x + (rect.width * i) / cells,
    y: rect.y + (rect.height * j) / cells,
  });
  let worst = 0;
  for (let i = 0; i < cells; i++) {
    for (let j = 0; j < cells; j++) {
      const [a, b, c] = [at(i, j), at(i + 1, j), at(i, j + 1)];
      // Centroid of the triangle: linear interpolation = average of the mapped vertices.
      const mid = { x: (a.x + b.x + c.x) / 3, y: (a.y + b.y + c.y) / 3 };
      const [ma, mb, mc] = [apply(h, a), apply(h, b), apply(h, c)];
      const linear = { x: (ma.x + mb.x + mc.x) / 3, y: (ma.y + mb.y + mc.y) / 3 };
      const exact = apply(h, mid);
      worst = Math.max(worst, Math.hypot(linear.x - exact.x, linear.y - exact.y));
    }
  }
  return worst;
}

const tile: PixelRect = { x: 0, y: 0, width: 4096, height: 3000 };

describe('tile meshes', () => {
  it('places tile corners through the transform, clockwise from top-left', () => {
    const scale: Mat3 = [0.1, 0, 5, 0, 0.1, 0, 0, 0, 1];
    const corners = tileCorners(scale, { x: 0, y: 0, width: 100, height: 50 });
    expect(flatCorners(corners)).toEqual([5, 0, 15, 0, 15, 5, 5, 5]);
  });

  it('keeps the perspective interpolation error below 0.1 photo pixel', () => {
    for (const truth of [TOP_TRUTH, BOTTOM_TRUTH]) {
      const imageToBoard = pixelsToBoard(truth);
      const mmPerPixel = Math.hypot(imageToBoard[0], imageToBoard[3]);
      const error = meshErrorMm(imageToBoard, tile, MESH_VERTICES);
      expect(error).toBeLessThan(0.1 * mmPerPixel);
    }
  });

  it('would be visibly wrong without subdivision (why the mesh is needed)', () => {
    const imageToBoard = pixelsToBoard(TOP_TRUTH);
    const mmPerPixel = Math.hypot(imageToBoard[0], imageToBoard[3]);
    expect(meshErrorMm(imageToBoard, tile, 2)).toBeGreaterThan(mmPerPixel);
  });
});

describe('isTileDrawable', () => {
  const rect: PixelRect = { x: 0, y: 0, width: 100, height: 100 };
  it('accepts tiles fully in front of the horizon', () => {
    expect(isTileDrawable(pixelsToBoard(TOP_TRUTH), tile)).toBe(true);
    expect(isTileDrawable([1, 0, 0, 0, 1, 0, 0, 0, 1], rect)).toBe(true);
  });

  it('rejects tiles the horizon crosses or lies in front of', () => {
    const horizonAtX50: Mat3 = [1, 0, 0, 0, 1, 0, -0.02, 0, 1];
    expect(isTileDrawable(horizonAtX50, rect)).toBe(false);
    expect(isTileDrawable(horizonAtX50, { x: 0, y: 0, width: 40, height: 100 })).toBe(true);
  });
});
