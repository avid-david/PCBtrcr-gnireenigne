/** A 2D point or vector. In board space the unit is millimetres. */
export interface Vec2 {
  readonly x: number;
  readonly y: number;
}

/** Component-wise sum. */
export const add = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x + b.x, y: a.y + b.y });

/** Component-wise difference `a − b`. */
export const sub = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x - b.x, y: a.y - b.y });

/** Multiplies both components by `factor`. */
export const scale = (v: Vec2, factor: number): Vec2 => ({ x: v.x * factor, y: v.y * factor });
