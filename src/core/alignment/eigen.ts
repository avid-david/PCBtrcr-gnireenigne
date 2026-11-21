/**
 * Eigen-decomposition of small symmetric matrices (cyclic Jacobi method). Used for the 9×9
 * normal matrix of the homography DLT, where accuracy matters more than speed.
 * Matrices are square, row-major `Float64Array`s of size n².
 */

const MAX_SWEEPS = 60;
/** Stop once the off-diagonal mass is this small relative to the whole matrix. */
const CONVERGED = Number.EPSILON ** 2;

/** Reads one entry; out-of-range reads give NaN so a bug cannot pass silently as 0. */
export const entry = (m: Float64Array, index: number): number => m[index] ?? Number.NaN;

function offDiagonalSquares(a: Float64Array, n: number): number {
  let sum = 0;
  for (let p = 0; p < n; p++) {
    for (let q = p + 1; q < n; q++) {
      sum += entry(a, p * n + q) ** 2;
    }
  }
  return sum;
}

/** Applies the rotation (c, s) in plane (p, q) to columns of `m`: m ← m·J. */
function rotateColumns(
  m: Float64Array,
  n: number,
  plane: readonly [number, number, number, number],
) {
  const [p, q, c, s] = plane;
  for (let k = 0; k < n; k++) {
    const kp = entry(m, k * n + p);
    const kq = entry(m, k * n + q);
    m[k * n + p] = c * kp - s * kq;
    m[k * n + q] = s * kp + c * kq;
  }
}

/** Applies the rotation to rows of `m`: m ← Jᵀ·m. */
function rotateRows(m: Float64Array, n: number, plane: readonly [number, number, number, number]) {
  const [p, q, c, s] = plane;
  for (let k = 0; k < n; k++) {
    const pk = entry(m, p * n + k);
    const qk = entry(m, q * n + k);
    m[p * n + k] = c * pk - s * qk;
    m[q * n + k] = s * pk + c * qk;
  }
}

/** The matrix being diagonalised, the accumulated eigenvectors and the size. */
interface Jacobi {
  readonly a: Float64Array;
  readonly v: Float64Array;
  readonly n: number;
}

/** Zeroes a[p][q] with one Jacobi rotation, accumulating it into the eigenvectors. */
function annihilate({ a, v, n }: Jacobi, p: number, q: number) {
  const apq = entry(a, p * n + q);
  if (apq === 0) {
    return;
  }
  const theta = (entry(a, q * n + q) - entry(a, p * n + p)) / (2 * apq);
  const t = (theta >= 0 ? 1 : -1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
  const c = 1 / Math.sqrt(t * t + 1);
  const plane = [p, q, c, t * c] as const;
  rotateColumns(a, n, plane);
  rotateRows(a, n, plane);
  rotateColumns(v, n, plane);
}

export interface Eigen {
  /** Eigenvalues in ascending order. */
  readonly values: readonly number[];
  /** Unit eigenvectors, `vectors[i]` belonging to `values[i]`. */
  readonly vectors: readonly (readonly number[])[];
}

/** Eigenvalues and eigenvectors of a symmetric n×n matrix (row-major). */
export function symmetricEigen(matrix: Float64Array, n: number): Eigen {
  const a = Float64Array.from(matrix);
  const v = new Float64Array(n * n);
  for (let i = 0; i < n; i++) {
    v[i * n + i] = 1;
  }
  const state: Jacobi = { a, v, n };
  const scale = a.reduce((s, x) => s + x * x, 0);
  for (let sweep = 0; sweep < MAX_SWEEPS && offDiagonalSquares(a, n) > CONVERGED * scale; sweep++) {
    for (let p = 0; p < n; p++) {
      for (let q = p + 1; q < n; q++) {
        annihilate(state, p, q);
      }
    }
  }
  const order = Array.from({ length: n }, (_, i) => i).sort(
    (i, j) => entry(a, i * n + i) - entry(a, j * n + j),
  );
  return {
    values: order.map((i) => entry(a, i * n + i)),
    vectors: order.map((i) => Array.from({ length: n }, (_, k) => entry(v, k * n + i))),
  };
}
