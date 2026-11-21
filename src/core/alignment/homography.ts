import { invert, isMat3, multiply, scaleEntries, type Mat3 } from '../geometry/mat3';
import type { Vec2 } from '../geometry/vec2';
import { err, ok, type Result } from '../result';
import { entry, symmetricEigen } from './eigen';
import { inputNormalisation, refineGeometric } from './leastSquares';

/** A point and the position it should map to. */
export interface Correspondence {
  readonly from: Vec2;
  readonly to: Vec2;
}

export type HomographyError = 'too-few-points' | 'degenerate';

export const MIN_POINTS = 4;

/** Below this ratio of second-smallest to largest eigenvalue the points do not fix a homography. */
const DEGENERACY_RATIO = 1e-12;

const normalise = (t: Mat3, p: Vec2): Vec2 => ({ x: t[0] * p.x + t[2], y: t[4] * p.y + t[5] });

/** AᵀA of the DLT system, accumulated row by row without building A. */
function normalMatrix(pairs: readonly Correspondence[], tFrom: Mat3, tTo: Mat3): Float64Array {
  const m = new Float64Array(81);
  const addRow = (row: readonly number[]) => {
    row.forEach((ri, i) => {
      row.forEach((rj, j) => {
        m[i * 9 + j] = entry(m, i * 9 + j) + ri * rj;
      });
    });
  };
  for (const pair of pairs) {
    const { x, y } = normalise(tFrom, pair.from);
    const { x: u, y: v } = normalise(tTo, pair.to);
    addRow([-x, -y, -1, 0, 0, 0, u * x, u * y, u]);
    addRow([0, 0, 0, -x, -y, -1, v * x, v * y, v]);
  }
  return m;
}

/** The DLT solution in normalised coordinates: the eigenvector of the smallest eigenvalue. */
function solveNormalised(m: Float64Array): Mat3 | null {
  const { values, vectors } = symmetricEigen(m, 9);
  const [, second] = values;
  const largest = values.at(-1);
  const h = vectors[0];
  const wellPosed =
    second !== undefined && largest !== undefined && second > DEGENERACY_RATIO * largest;
  return wellPosed && h !== undefined && isMat3(h) ? h : null;
}

/**
 * Homography mapping every `from` to its `to`: normalised DLT, refined to the geometric
 * least-squares fit (distances in the target space) when there are more than 4 points. Fails for fewer than 4 points and for degenerate
 * layouts such as 3 collinear points out of 4.
 */
export function solveHomography(pairs: readonly Correspondence[]): Result<Mat3, HomographyError> {
  if (pairs.length < MIN_POINTS) {
    return err('too-few-points');
  }
  const tFrom = inputNormalisation(pairs.map((p) => p.from));
  const tTo = inputNormalisation(pairs.map((p) => p.to));
  const normalised = solveNormalised(normalMatrix(pairs, tFrom, tTo));
  const inverseTo = invert(tTo);
  if (normalised === null || !inverseTo.ok) {
    return err('degenerate');
  }
  const h = multiply(inverseTo.value, multiply(normalised, tFrom));
  if (Math.abs(h[8]) < Number.EPSILON) {
    return err('degenerate');
  }
  return ok(refineGeometric(scaleEntries(h, 1 / h[8]), pairs));
}
