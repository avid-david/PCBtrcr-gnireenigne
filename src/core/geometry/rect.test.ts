import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { affine, point } from './arbitraries.test-support';
import { apply, translation } from './mat3';
import {
  boundsOfPoints,
  rectCenter,
  rectCorners,
  rectFromSize,
  rectHeight,
  rectWidth,
  transformRect,
  unionRects,
} from './rect';

const contains = (
  r: { minX: number; minY: number; maxX: number; maxY: number },
  p: { x: number; y: number },
) => p.x >= r.minX - 1e-9 && p.x <= r.maxX + 1e-9 && p.y >= r.minY - 1e-9 && p.y <= r.maxY + 1e-9;

describe('rect', () => {
  it('measures size and centre', () => {
    const r = rectFromSize(40, 20);
    expect([rectWidth(r), rectHeight(r)]).toEqual([40, 20]);
    expect(rectCenter(r)).toEqual({ x: 20, y: 10 });
  });

  it('boundsOfPoints contains every point and is null for none', () => {
    expect(boundsOfPoints([])).toBeNull();
    fc.assert(
      fc.property(fc.array(point, { minLength: 1, maxLength: 20 }), (points) => {
        const bounds = boundsOfPoints(points);
        return bounds !== null && points.every((p) => contains(bounds, p));
      }),
    );
  });

  it('transformRect contains the transformed corners', () => {
    fc.assert(
      fc.property(affine, (m) => {
        const r = rectFromSize(30, 10);
        const t = transformRect(m, r);
        return rectCorners(r).every((c) => contains(t, apply(m, c)));
      }),
    );
  });

  it('transformRect of a translation shifts the rectangle', () => {
    expect(transformRect(translation(5, -5), rectFromSize(2, 2))).toEqual({
      minX: 5,
      minY: -5,
      maxX: 7,
      maxY: -3,
    });
  });

  it('unionRects covers all inputs and is null for none', () => {
    expect(unionRects([])).toBeNull();
    expect(unionRects([rectFromSize(1, 1), { minX: -1, minY: 2, maxX: 0, maxY: 3 }])).toEqual({
      minX: -1,
      minY: 0,
      maxX: 1,
      maxY: 3,
    });
  });
});
