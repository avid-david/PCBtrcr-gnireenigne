import { err, ok, type Result } from '../result';
import type { Vec2 } from './vec2';

/**
 * 3×3 matrix in row-major order, acting on column vectors (x, y, 1).
 * Affine transforms use the first two rows; homographies (M2) also use the third.
 */
export type Mat3 = readonly [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
];

const SINGULAR_EPSILON = 1e-12;

/** The identity transform. */
export const IDENTITY: Mat3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];

/** Translation by (tx, ty). */
export const translation = (tx: number, ty: number): Mat3 => [1, 0, tx, 0, 1, ty, 0, 0, 1];

/** Non-uniform scale about the origin. */
export const scaling = (sx: number, sy: number): Mat3 => [sx, 0, 0, 0, sy, 0, 0, 0, 1];

/** Whether a list of numbers has exactly the nine entries of a Mat3. */
export const isMat3 = (values: readonly number[]): values is Mat3 => values.length === 9;

/** Every entry multiplied by `k` (homographies are only defined up to such a factor). */
export const scaleEntries = (m: Mat3, k: number): Mat3 => [
  m[0] * k,
  m[1] * k,
  m[2] * k,
  m[3] * k,
  m[4] * k,
  m[5] * k,
  m[6] * k,
  m[7] * k,
  m[8] * k,
];

/** Whether the matrix is affine (no perspective row), so it maps parallel lines to parallel lines. */
export const isAffine = (m: Mat3): boolean => m[6] === 0 && m[7] === 0 && m[8] === 1;

/** Matrix product `a · b`: applying the result equals applying `b` first, then `a`. */
export function multiply(a: Mat3, b: Mat3): Mat3 {
  const [a0, a1, a2, a3, a4, a5, a6, a7, a8] = a;
  const [b0, b1, b2, b3, b4, b5, b6, b7, b8] = b;
  return [
    a0 * b0 + a1 * b3 + a2 * b6,
    a0 * b1 + a1 * b4 + a2 * b7,
    a0 * b2 + a1 * b5 + a2 * b8,
    a3 * b0 + a4 * b3 + a5 * b6,
    a3 * b1 + a4 * b4 + a5 * b7,
    a3 * b2 + a4 * b5 + a5 * b8,
    a6 * b0 + a7 * b3 + a8 * b6,
    a6 * b1 + a7 * b4 + a8 * b7,
    a6 * b2 + a7 * b5 + a8 * b8,
  ];
}

/** Composes transforms in application order: `compose(f, g)` applies `f`, then `g`. */
export const compose = (...steps: readonly Mat3[]): Mat3 =>
  steps.reduce((acc, step) => multiply(step, acc), IDENTITY);

/** Applies the transform to a point, including the projective divide. */
export function apply(m: Mat3, p: Vec2): Vec2 {
  const [a, b, c, d, e, f, g, h, i] = m;
  const w = g * p.x + h * p.y + i;
  return { x: (a * p.x + b * p.y + c) / w, y: (d * p.x + e * p.y + f) / w };
}

/** Determinant of the matrix. */
export function determinant(m: Mat3): number {
  const [a, b, c, d, e, f, g, h, i] = m;
  return a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g);
}

/** Inverse transform, or an error when the matrix is singular. */
export function invert(m: Mat3): Result<Mat3, 'singular'> {
  const det = determinant(m);
  if (Math.abs(det) < SINGULAR_EPSILON) {
    return err('singular');
  }
  const [a, b, c, d, e, f, g, h, i] = m;
  const s = 1 / det;
  return ok([
    (e * i - f * h) * s,
    (c * h - b * i) * s,
    (b * f - c * e) * s,
    (f * g - d * i) * s,
    (a * i - c * g) * s,
    (c * d - a * f) * s,
    (d * h - e * g) * s,
    (b * g - a * h) * s,
    (a * e - b * d) * s,
  ]);
}
