import { segmentDistance } from './distance';
import type { Vec2 } from './vec2';

/** Whether `p` lies inside the polygon (even-odd rule; the last point joins the first). */
export function pointInPolygon(p: Vec2, polygon: readonly Vec2[]): boolean {
  let inside = false;
  polygon.forEach((a, i) => {
    const b = polygon[(i + 1) % polygon.length] ?? a;
    const crosses = a.y > p.y !== b.y > p.y;
    if (crosses && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) {
      inside = !inside;
    }
  });
  return inside;
}

/** Distance from `p` to the polygon's area (0 inside). */
export function polygonDistance(p: Vec2, polygon: readonly Vec2[]): number {
  if (pointInPolygon(p, polygon)) {
    return 0;
  }
  const edges = polygon.map((a, i) =>
    segmentDistance(p, a, polygon[(i + 1) % polygon.length] ?? a),
  );
  return Math.min(...edges);
}

/** Distance from `p` to an open polyline. */
export function polylineDistance(p: Vec2, points: readonly Vec2[]): number {
  const first = points[0];
  if (first === undefined) {
    return Number.POSITIVE_INFINITY;
  }
  const segments = points.slice(1).map((b, i) => segmentDistance(p, points[i] ?? b, b));
  return Math.min(segmentDistance(p, first, first), ...segments);
}
