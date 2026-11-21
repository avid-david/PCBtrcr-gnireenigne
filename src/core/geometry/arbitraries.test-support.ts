import fc from 'fast-check';
import type { Mat3 } from './mat3';
import type { Vec2 } from './vec2';
import type { Viewport } from './viewport';

// Shared fast-check generators for geometry property tests. Ranges stay in values a PCB
// editor meets (sub-micron to metres) so floating-point tolerances remain meaningful.

export const coord = fc.double({ min: -1000, max: 1000, noNaN: true, noDefaultInfinity: true });

export const point: fc.Arbitrary<Vec2> = fc.record({ x: coord, y: coord });

const factor = fc.double({ min: 0.1, max: 10, noNaN: true });
const sign = fc.constantFrom(-1, 1);

/** Well-conditioned affine transforms: scale, optional mirror, rotation and translation. */
export const affine: fc.Arbitrary<Mat3> = fc
  .record({
    sx: factor,
    sy: factor,
    mirror: sign,
    angle: fc.double({ min: 0, max: 6.28, noNaN: true }),
    tx: coord,
    ty: coord,
  })
  .map(({ sx, sy, mirror, angle, tx, ty }) => {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    return [c * sx * mirror, -s * sy, tx, s * sx * mirror, c * sy, ty, 0, 0, 1] as const;
  });

export const viewport: fc.Arbitrary<Viewport> = fc.record({
  zoom: fc.double({ min: 0.05, max: 200, noNaN: true }),
  offset: point,
});

/** Asserts two points are equal within an absolute tolerance. */
export function closeTo(a: Vec2, b: Vec2, tolerance = 1e-6): boolean {
  return Math.abs(a.x - b.x) <= tolerance && Math.abs(a.y - b.y) <= tolerance;
}
