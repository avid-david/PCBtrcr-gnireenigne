import { apply, invert, multiply, scaleEntries, type Mat3 } from '../geometry/mat3';
import type { Vec2 } from '../geometry/vec2';
import { entry, symmetricEigen } from './eigen';

// Geometric least squares for homographies, shared by the solver (Gauss–Newton refinement) and
// the outlier test (leverage). Parameters are the first 8 entries of the matrix with the last
// fixed to 1, expressed in normalised input coordinates so the Jacobian is well-conditioned.

export const PARAMETERS = 8;

export type Row = readonly number[];

/** Partial derivatives of the mapped point (u, v) with respect to the 8 parameters. */
export function jacobianRows(h: Mat3, p: Vec2): [Row, Row] {
  const w = h[6] * p.x + h[7] * p.y + h[8];
  const q = apply(h, p);
  return [
    [p.x / w, p.y / w, 1 / w, 0, 0, 0, (-q.x * p.x) / w, (-q.x * p.y) / w],
    [0, 0, 0, p.x / w, p.y / w, 1 / w, (-q.y * p.x) / w, (-q.y * p.y) / w],
  ];
}

/** m += k·v·vᵀ */
function addScaledOuter(m: Float64Array, v: Row, k: number): void {
  v.forEach((vi, i) => {
    v.forEach((vj, j) => {
      m[i * PARAMETERS + j] = entry(m, i * PARAMETERS + j) + k * vi * vj;
    });
  });
}

/** (JᵀJ)⁺, ignoring parameter directions the points do not constrain. */
export function normalInverse(rows: readonly Row[]): Float64Array {
  const jtj = new Float64Array(PARAMETERS * PARAMETERS);
  rows.forEach((row) => {
    addScaledOuter(jtj, row, 1);
  });
  const { values, vectors } = symmetricEigen(jtj, PARAMETERS);
  const largest = Math.max(...values);
  const inverse = new Float64Array(PARAMETERS * PARAMETERS);
  values.forEach((lambda, k) => {
    const v = vectors[k];
    if (v !== undefined && lambda > 1e-12 * largest) {
      addScaledOuter(inverse, v, 1 / lambda);
    }
  });
  return inverse;
}

/** aᵀ·M·b for an 8×8 matrix M. */
export const bilinear = (m: Float64Array, a: Row, b: Row): number =>
  a.reduce(
    (sum, ai, i) => sum + ai * b.reduce((s, bj, j) => s + entry(m, i * PARAMETERS + j) * bj, 0),
    0,
  );

/** Input normalisation (centroid to 0, mean distance √2), the same as the DLT's. */
export function inputNormalisation(points: readonly Vec2[]): Mat3 {
  const n = points.length;
  const cx = points.reduce((s, p) => s + p.x, 0) / n;
  const cy = points.reduce((s, p) => s + p.y, 0) / n;
  const mean = points.reduce((s, p) => s + Math.hypot(p.x - cx, p.y - cy), 0) / n;
  const k = mean > 0 ? Math.SQRT2 / mean : 1;
  return [k, 0, -k * cx, 0, k, -k * cy, 0, 0, 1];
}

/** The homography re-expressed for normalised inputs, scaled so its last entry is 1. */
export function inNormalisedInput(h: Mat3, normalise: Mat3): Mat3 {
  const inverse = invert(normalise);
  const hn = inverse.ok ? multiply(h, inverse.value) : h;
  return scaleEntries(hn, 1 / hn[8]);
}

/** Steps of Gauss–Newton refinement; the DLT start is close, so a few steps converge. */
const REFINEMENT_STEPS = 5;

interface Pair {
  readonly from: Vec2;
  readonly to: Vec2;
}

/** One Gauss–Newton step on the 8 parameters of `hn` (inputs already normalised). */
function gaussNewtonStep(hn: Mat3, inputs: readonly Vec2[], pairs: readonly Pair[]): Mat3 {
  const jtr = new Float64Array(PARAMETERS);
  const rows: Row[] = [];
  inputs.forEach((p, i) => {
    const q = apply(hn, p);
    const to = pairs[i]?.to ?? q;
    const [ru, rv] = jacobianRows(hn, p);
    rows.push(ru, rv);
    ru.forEach((v, k) => (jtr[k] = entry(jtr, k) + v * (to.x - q.x)));
    rv.forEach((v, k) => (jtr[k] = entry(jtr, k) + v * (to.y - q.y)));
  });
  const m = normalInverse(rows);
  const step = (i: number): number =>
    Array.from(jtr).reduce((s, v, k) => s + entry(m, i * PARAMETERS + k) * v, 0);
  return [
    hn[0] + step(0),
    hn[1] + step(1),
    hn[2] + step(2),
    hn[3] + step(3),
    hn[4] + step(4),
    hn[5] + step(5),
    hn[6] + step(6),
    hn[7] + step(7),
    1,
  ];
}

/**
 * Refines a homography to minimise the geometric error (sum of squared distances in the target
 * space) rather than the DLT's algebraic error. Leaves exact 4-point solutions unchanged.
 */
export function refineGeometric(h: Mat3, pairs: readonly Pair[]): Mat3 {
  const normalise = inputNormalisation(pairs.map((p) => p.from));
  const inputs = pairs.map((p) => apply(normalise, p.from));
  let hn = inNormalisedInput(h, normalise);
  for (let i = 0; i < REFINEMENT_STEPS; i++) {
    hn = gaussNewtonStep(hn, inputs, pairs);
  }
  const refined = multiply(hn, normalise);
  return scaleEntries(refined, 1 / refined[8]);
}
