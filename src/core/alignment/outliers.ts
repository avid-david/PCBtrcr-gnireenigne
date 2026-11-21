import { apply, type Mat3 } from '../geometry/mat3';
import { solveHomography, type Correspondence } from './homography';
import {
  PARAMETERS,
  bilinear,
  inNormalisedInput,
  inputNormalisation,
  jacobianRows,
  normalInverse,
} from './leastSquares';

// Outlier test with externally studentized residuals (docs/adr/0004). A raw residual cannot
// identify a mis-click among few points: the least-squares fit bends towards the bad point, by
// a different amount per point (its leverage). For each point we compute what the fit would
// leave unexplained without it, and compare that with the noise of the other points. The
// ratio follows an F(2, ν) distribution for good clicks, which gives an exact threshold.

/** Chance of flagging a good point, shared over all points of a fit. */
export const FALSE_ALARM_RATE = 0.01;

/** Upper α-quantile of the F(2, ν) distribution (closed form for 2 numerator degrees of freedom). */
export const fQuantile = (dof: number, alpha: number): number =>
  (dof / 2) * (alpha ** (-2 / dof) - 1);

/** Points closer than this to the fit are never flagged, so near-perfect fits flag nothing. */
export const OUTLIER_MIN_MM = 0.1;

const squaredError = (h: Mat3, pair: Correspondence): number => {
  const q = apply(h, pair.from);
  return (pair.to.x - q.x) ** 2 + (pair.to.y - q.y) ** 2;
};

/** eᵀ(I − P)⁻¹e per point: the squared error left once the fit may not bend towards the point. */
function deletedErrors(h: Mat3, pairs: readonly Correspondence[]): number[] {
  const normalise = inputNormalisation(pairs.map((p) => p.from));
  const hn = inNormalisedInput(h, normalise);
  const rows = pairs.map((p) => jacobianRows(hn, apply(normalise, p.from)));
  const m = normalInverse(rows.flat());
  return pairs.map((pair, i) => {
    const [ru, rv] = rows[i] ?? [[], []];
    const q = apply(h, pair.from);
    const ex = pair.to.x - q.x;
    const ey = pair.to.y - q.y;
    const a = 1 - bilinear(m, ru, ru);
    const b = -bilinear(m, ru, rv);
    const d = 1 - bilinear(m, rv, rv);
    const det = Math.max(a * d - b * b, 1e-12);
    return Math.max((d * ex * ex - 2 * b * ex * ey + a * ey * ey) / det, 0);
  });
}

/**
 * Index of the point that disagrees most with the others, if it does so beyond what their noise
 * explains (F-test) and by more than `OUTLIER_MIN_MM`; `null` otherwise or with too few points.
 */
function worstOutlier(pairs: readonly Correspondence[]): number | null {
  const dof = 2 * pairs.length - PARAMETERS - 2;
  const fit = dof >= 1 ? solveHomography(pairs) : null;
  if (fit?.ok !== true) {
    return null;
  }
  const ssr = pairs.reduce((s, p) => s + squaredError(fit.value, p), 0);
  const scores = deletedErrors(fit.value, pairs).map(
    (deleted) => deleted / 2 / (Math.max(ssr - deleted, Number.MIN_VALUE) / dof),
  );
  const worst = scores.indexOf(Math.max(...scores));
  const pair = pairs[worst];
  const significant = (scores[worst] ?? 0) > fQuantile(dof, FALSE_ALARM_RATE / pairs.length);
  const visible = pair !== undefined && squaredError(fit.value, pair) > OUTLIER_MIN_MM ** 2;
  return significant && visible ? worst : null;
}

/**
 * For each point, whether it is an outlier. One point is flagged at a time and the test is
 * repeated without it: a large mis-click inflates the fit for everyone, and testing all points
 * at once would then also flag good ones.
 */
export function outlierFlags(pairs: readonly Correspondence[]): boolean[] {
  const flags = pairs.map(() => false);
  let active = pairs.map((_, i) => i);
  for (;;) {
    const worst = worstOutlier(active.map((i) => pairs[i]).filter((p) => p !== undefined));
    const index = worst === null ? undefined : active[worst];
    if (index === undefined) {
      return flags;
    }
    flags[index] = true;
    active = active.filter((i) => i !== index);
  }
}
