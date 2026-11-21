import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { closeTo } from '../geometry/arbitraries.test-support';
import { IDENTITY, apply, type Mat3 } from '../geometry/mat3';
import type { Vec2 } from '../geometry/vec2';
import { solveHomography } from './homography';

/** Four points spread over the quadrants of a square, so no three are collinear. */
const unit = fc.double({ min: 0.1, max: 0.9, noNaN: true });
const quad: fc.Arbitrary<Vec2[]> = fc
  .tuple(unit, unit, unit, unit, unit, unit, unit, unit)
  .map(([a, b, c, d, e, f, g, h]) => [
    { x: a * 500, y: b * 500 },
    { x: 1000 - c * 500, y: d * 500 },
    { x: 1000 - e * 500, y: 1000 - f * 500 },
    { x: g * 500, y: 1000 - h * 500 },
  ]);

/** Mild perspective transforms like a hand-held photo of a board: pixels → mm. */
const perspective: fc.Arbitrary<Mat3> = fc
  .record({
    scale: fc.double({ min: 0.02, max: 0.2, noNaN: true }),
    skew: fc.double({ min: -0.01, max: 0.01, noNaN: true }),
    px: fc.double({ min: -1e-4, max: 1e-4, noNaN: true }),
    py: fc.double({ min: -1e-4, max: 1e-4, noNaN: true }),
    mirror: fc.constantFrom(1, -1),
    tx: fc.double({ min: -50, max: 50, noNaN: true }),
  })
  .map(({ scale, skew, px, py, mirror, tx }) => [
    mirror * scale,
    skew,
    tx,
    skew,
    scale,
    -tx,
    px,
    py,
    1,
  ]);

const pairsFor = (m: Mat3, points: readonly Vec2[]) =>
  points.map((from) => ({ from, to: apply(m, from) }));

const unwrap = (r: ReturnType<typeof solveHomography>): Mat3 => (r.ok ? r.value : IDENTITY);

describe('solveHomography', () => {
  it('the homography of 4 points onto themselves is the identity', () => {
    fc.assert(
      fc.property(quad, (points) => {
        const h = unwrap(solveHomography(points.map((p) => ({ from: p, to: p }))));
        return h.every((v, i) => Math.abs(v - (IDENTITY[i] ?? 0)) < 1e-9);
      }),
    );
  });

  it('recovers a known perspective transform exactly from 4 points', () => {
    fc.assert(
      fc.property(perspective, quad, (m, points) => {
        const h = unwrap(solveHomography(pairsFor(m, points)));
        const probe = { x: 321, y: 654 };
        return closeTo(apply(h, probe), apply(m, probe), 1e-6);
      }),
    );
  });

  it('fits more than 4 noisy points in the least-squares sense', () => {
    const truth: Mat3 = [0.05, 0.001, 2, -0.002, 0.05, 3, 2e-6, -1e-6, 1];
    const grid = Array.from({ length: 9 }, (_, i) => ({
      x: (i % 3) * 400 + 100,
      y: Math.floor(i / 3) * 300 + 50,
    }));
    const noisy = pairsFor(truth, grid).map((p, i) => ({
      from: p.from,
      to: { x: p.to.x + (i % 2 ? 0.01 : -0.01), y: p.to.y + (i % 3 ? -0.01 : 0.01) },
    }));
    const h = unwrap(solveHomography(noisy));
    expect(closeTo(apply(h, { x: 500, y: 400 }), apply(truth, { x: 500, y: 400 }), 0.02)).toBe(
      true,
    );
  });

  it('handles mirrored mappings (bottom photos)', () => {
    const mirror: Mat3 = [-0.1, 0, 80, 0, 0.1, 0, 0, 0, 1];
    const h = unwrap(
      solveHomography(
        pairsFor(mirror, [
          { x: 0, y: 0 },
          { x: 800, y: 0 },
          { x: 800, y: 500 },
          { x: 0, y: 500 },
        ]),
      ),
    );
    expect(closeTo(apply(h, { x: 400, y: 250 }), { x: 40, y: 25 })).toBe(true);
  });

  it('needs at least 4 points', () => {
    const three = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 0, y: 1 },
    ].map((p) => ({ from: p, to: p }));
    expect(solveHomography(three)).toEqual({ ok: false, error: 'too-few-points' });
  });

  it('rejects degenerate layouts instead of returning garbage', () => {
    const collinear = [0, 1, 2, 3].map((i) => ({ from: { x: i, y: i }, to: { x: i, y: 0 } }));
    expect(solveHomography(collinear)).toEqual({ ok: false, error: 'degenerate' });
    const same = [0, 1, 2, 3].map(() => ({ from: { x: 5, y: 5 }, to: { x: 1, y: 1 } }));
    expect(solveHomography(same)).toEqual({ ok: false, error: 'degenerate' });
  });
});
