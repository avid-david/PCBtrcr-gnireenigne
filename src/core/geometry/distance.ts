import type { Rect } from './rect';
import type { Vec2 } from './vec2';

/** Distance between two points. */
export const distance = (a: Vec2, b: Vec2): number => Math.hypot(a.x - b.x, a.y - b.y);

/** Distance from `p` to the segment `a`–`b`. */
export function segmentDistance(p: Vec2, a: Vec2, b: Vec2): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSquared = dx * dx + dy * dy;
  const t =
    lengthSquared === 0
      ? 0
      : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSquared));
  return distance(p, { x: a.x + t * dx, y: a.y + t * dy });
}

/** Distance from `p` to the rectangle (0 inside). */
export function rectDistance(p: Vec2, r: Rect): number {
  const dx = Math.max(r.minX - p.x, 0, p.x - r.maxX);
  const dy = Math.max(r.minY - p.y, 0, p.y - r.maxY);
  return Math.hypot(dx, dy);
}

/** Whether two rectangles overlap or touch. */
export const rectsIntersect = (a: Rect, b: Rect): boolean =>
  a.minX <= b.maxX && b.minX <= a.maxX && a.minY <= b.maxY && b.minY <= a.maxY;

/** Rectangle spanned by two corner points in any order. */
export const rectBetween = (a: Vec2, b: Vec2): Rect => ({
  minX: Math.min(a.x, b.x),
  minY: Math.min(a.y, b.y),
  maxX: Math.max(a.x, b.x),
  maxY: Math.max(a.y, b.y),
});
