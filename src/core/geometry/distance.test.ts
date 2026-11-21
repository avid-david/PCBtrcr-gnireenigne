import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { point } from './arbitraries.test-support';
import { distance, rectBetween, rectDistance, rectsIntersect, segmentDistance } from './distance';

describe('distance helpers', () => {
  it('measures to points, segments and rectangles', () => {
    expect(distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
    expect(segmentDistance({ x: 5, y: 3 }, { x: 0, y: 0 }, { x: 10, y: 0 })).toBe(3);
    expect(segmentDistance({ x: -3, y: 4 }, { x: 0, y: 0 }, { x: 10, y: 0 })).toBe(5);
    expect(segmentDistance({ x: 1, y: 1 }, { x: 2, y: 2 }, { x: 2, y: 2 })).toBeCloseTo(Math.SQRT2);
    const r = { minX: 0, minY: 0, maxX: 4, maxY: 2 };
    expect(rectDistance({ x: 1, y: 1 }, r)).toBe(0);
    expect(rectDistance({ x: 7, y: 6 }, r)).toBe(5);
  });

  it('a segment is never farther than its nearer end', () => {
    fc.assert(
      fc.property(point, point, point, (p, a, b) => {
        const d = segmentDistance(p, a, b);
        return d <= Math.min(distance(p, a), distance(p, b)) + 1e-9;
      }),
    );
  });

  it('builds rectangles from any two corners and tests overlap', () => {
    const r = rectBetween({ x: 4, y: 0 }, { x: 0, y: 3 });
    expect(r).toEqual({ minX: 0, minY: 0, maxX: 4, maxY: 3 });
    expect(rectsIntersect(r, { minX: 4, minY: 3, maxX: 9, maxY: 9 })).toBe(true);
    expect(rectsIntersect(r, { minX: 4.1, minY: 0, maxX: 9, maxY: 9 })).toBe(false);
    expect(rectsIntersect(r, { minX: 0, minY: 3.1, maxX: 1, maxY: 9 })).toBe(false);
  });
});
