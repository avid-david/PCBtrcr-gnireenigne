import { apply, type Mat3 } from '../geometry/mat3';
import type { Vec2 } from '../geometry/vec2';
import type { PointRef } from '../model/points';
import type { Correspondence } from './homography';
import { outlierFlags } from './outliers';

/** A clicked point and the board position it should map to. */
export interface Target extends Correspondence {
  readonly ref: PointRef;
}

/** How well one clicked point agrees with the fitted alignment. */
export interface PointFit {
  readonly ref: PointRef;
  /** Distance in mm between where the alignment puts the point and where it should be. */
  readonly residualMm: number;
  readonly outlier: boolean;
}

const distance = (a: Vec2, b: Vec2): number => Math.hypot(a.x - b.x, a.y - b.y);

/** Root mean square of the values; 0 for none. */
export const rms = (values: readonly number[]): number =>
  values.length === 0 ? 0 : Math.sqrt(values.reduce((s, v) => s + v * v, 0) / values.length);

/** Residual and outlier flag for every target, plus the RMS residual in mm. */
export function fitsFor(
  transform: Mat3,
  targets: readonly Target[],
): { fits: PointFit[]; rmsMm: number } {
  const residuals = targets.map((t) => distance(apply(transform, t.from), t.to));
  const flags = outlierFlags(targets);
  const fits = targets.map((t, i) => {
    const residualMm = residuals[i] ?? Number.NaN;
    return { ref: t.ref, residualMm, outlier: flags[i] === true };
  });
  return { fits, rmsMm: rms(residuals) };
}
