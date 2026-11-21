import { rectDistance } from '../geometry/distance';
import { bounds, boundsOfPoints, rectCorners, type Rect } from '../geometry/rect';
import { add, sub, type Vec2 } from '../geometry/vec2';
import type { Component, ComponentPad } from './features';

// A component's pads and outline are stored in its own frame: as on the footprint, seen from
// the side it is mounted on. Board position = at + rotate(mirror-if-flipped(local)).

const radians = (deg: number) => (deg * Math.PI) / 180;

/** Rotation angle in [0, 360), without -0 and floating-point noise from repeated turns. */
export const normalizeAngle = (deg: number): number => {
  const a = Math.round((((deg % 360) + 360) % 360) * 1e9) / 1e9;
  return (a >= 360 ? a - 360 : a) + 0;
};

/** Board position of a point given in the component's frame. */
export function toBoard(c: Component, local: Vec2): Vec2 {
  const x = c.flipped ? -local.x : local.x;
  const t = radians(c.rotationDeg);
  const [cos, sin] = [Math.cos(t), Math.sin(t)];
  return add(c.at, { x: x * cos - local.y * sin, y: x * sin + local.y * cos });
}

/** The component-frame point that lands on board position `p` (inverse of `toBoard`). */
export function toLocal(c: Component, p: Vec2): Vec2 {
  const d = sub(p, c.at);
  const t = radians(-c.rotationDeg);
  const [cos, sin] = [Math.cos(t), Math.sin(t)];
  const x = d.x * cos - d.y * sin;
  return { x: c.flipped ? -x : x, y: d.x * sin + d.y * cos };
}

/** Rectangle covered by a pad, in the component's frame. */
export const padRect = (pad: ComponentPad): Rect => ({
  minX: pad.at.x - pad.widthMm / 2,
  minY: pad.at.y - pad.heightMm / 2,
  maxX: pad.at.x + pad.widthMm / 2,
  maxY: pad.at.y + pad.heightMm / 2,
});

/** Bounding box of pads and outline in the component's frame. */
export function localBounds(c: Component): Rect {
  const points = [...c.pads.flatMap((p) => rectCorners(padRect(p))), ...c.outline.flat()];
  return boundsOfPoints(points) ?? { minX: 0, minY: 0, maxX: 0, maxY: 0 };
}

/** Bounding box on the board. */
export function componentBounds(c: Component): Rect {
  const [a, b, d, e] = rectCorners(localBounds(c)).map((p) => toBoard(c, p)) as [
    Vec2,
    Vec2,
    Vec2,
    Vec2,
  ];
  return bounds([a, b, d, e]);
}

/** Distance from a board point to the component: 0 inside its body, else to the nearest pad. */
export function componentDistance(c: Component, p: Vec2): number {
  const local = toLocal(c, p);
  const body = boundsOfPoints(c.outline.flat());
  if (body !== null && rectDistance(local, body) === 0) {
    return 0;
  }
  return Math.min(...c.pads.map((pad) => rectDistance(local, padRect(pad))));
}

/** The component turned clockwise by `deg` about its origin. */
export const rotateComponent = (c: Component, deg: number): Component => ({
  ...c,
  rotationDeg: normalizeAngle(c.rotationDeg + deg),
});

const ARC_STEPS = 12;

/** Points of an arc around `c` from angle `from` to `to` (radians), both ends included. */
const arc = (c: Vec2, r: { x: number; y: number }, [from, to]: [number, number]): Vec2[] =>
  Array.from({ length: ARC_STEPS + 1 }, (_, i) => {
    const t = from + ((to - from) * i) / ARC_STEPS;
    return { x: c.x + r.x * Math.cos(t), y: c.y + r.y * Math.sin(t) };
  });

const padShapes: Readonly<Record<ComponentPad['shape'], (p: ComponentPad) => Vec2[]>> = {
  rect: (p) => rectCorners(padRect(p)),
  round: (p) => arc(p.at, { x: p.widthMm / 2, y: p.heightMm / 2 }, [0, 2 * Math.PI]).slice(0, -1),
  oval: (p) => {
    // A stadium: two half circles joined along the long side.
    const r = Math.min(p.widthMm, p.heightMm) / 2;
    const wide = p.widthMm >= p.heightMm;
    const off = (Math.max(p.widthMm, p.heightMm) - 2 * r) / 2;
    const [a, b] = wide
      ? [
          { x: p.at.x + off, y: p.at.y },
          { x: p.at.x - off, y: p.at.y },
        ]
      : [
          { x: p.at.x, y: p.at.y + off },
          { x: p.at.x, y: p.at.y - off },
        ];
    const start = wide ? -Math.PI / 2 : 0;
    return [
      ...arc(a, { x: r, y: r }, [start, start + Math.PI]),
      ...arc(b, { x: r, y: r }, [start + Math.PI, start + 2 * Math.PI]),
    ];
  },
};

/** Outline of a pad as a polygon on the board (rotated and mirrored with its component). */
export const padPolygon = (c: Component, pad: ComponentPad): Vec2[] =>
  padShapes[pad.shape](pad).map((p) => toBoard(c, p));
