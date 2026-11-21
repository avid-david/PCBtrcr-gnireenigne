import { apply, type Mat3 } from './mat3';
import type { Vec2 } from './vec2';

/** Axis-aligned rectangle given by its minimum and maximum corners. */
export interface Rect {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

/** Rectangle from the origin with the given size. */
export const rectFromSize = (width: number, height: number): Rect => ({
  minX: 0,
  minY: 0,
  maxX: width,
  maxY: height,
});

/** Width of the rectangle. */
export const rectWidth = (r: Rect): number => r.maxX - r.minX;

/** Height of the rectangle. */
export const rectHeight = (r: Rect): number => r.maxY - r.minY;

/** Centre point of the rectangle. */
export const rectCenter = (r: Rect): Vec2 => ({
  x: (r.minX + r.maxX) / 2,
  y: (r.minY + r.maxY) / 2,
});

/** Smallest rectangle containing all points; `null` for no points. */
export function boundsOfPoints(points: readonly Vec2[]): Rect | null {
  const [first, ...rest] = points;
  return first === undefined ? null : bounds([first, ...rest]);
}

/** Smallest rectangle containing the given (at least one) points. */
export function bounds(points: readonly [Vec2, ...Vec2[]]): Rect {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  return {
    minX: Math.min(...xs),
    minY: Math.min(...ys),
    maxX: Math.max(...xs),
    maxY: Math.max(...ys),
  };
}

/** Corners in order top-left, top-right, bottom-right, bottom-left. */
export const rectCorners = (r: Rect): [Vec2, Vec2, Vec2, Vec2] => [
  { x: r.minX, y: r.minY },
  { x: r.maxX, y: r.minY },
  { x: r.maxX, y: r.maxY },
  { x: r.minX, y: r.maxY },
];

/** Bounding box of the rectangle after transforming its corners. */
export function transformRect(m: Mat3, r: Rect): Rect {
  const [a, b, c, d] = rectCorners(r);
  return bounds([apply(m, a), apply(m, b), apply(m, c), apply(m, d)]);
}

/** Smallest rectangle containing all given rectangles; `null` for none. */
export function unionRects(rects: readonly Rect[]): Rect | null {
  return boundsOfPoints(rects.flatMap(rectCorners));
}
