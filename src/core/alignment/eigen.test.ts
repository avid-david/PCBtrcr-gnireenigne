import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { entry, symmetricEigen } from './eigen';

const size = 5;

/** Random symmetric matrices with entries in a moderate range. */
const symmetric = fc
  .array(fc.double({ min: -10, max: 10, noNaN: true }), {
    minLength: size * size,
    maxLength: size * size,
  })
  .map((values) => {
    const m = Float64Array.from(values);
    for (let i = 0; i < size; i++) {
      for (let j = 0; j < i; j++) {
        m[i * size + j] = entry(m, j * size + i);
      }
    }
    return m;
  });

const multiplyVector = (m: Float64Array, v: readonly number[]): number[] =>
  Array.from({ length: size }, (_, i) =>
    v.reduce((sum, vj, j) => sum + entry(m, i * size + j) * vj, 0),
  );

describe('symmetricEigen', () => {
  it('returns a diagonal matrix’s entries in ascending order', () => {
    const { values, vectors } = symmetricEigen(Float64Array.from([3, 0, 0, 0, -1, 0, 0, 0, 2]), 3);
    expect(values).toEqual([-1, 2, 3]);
    expect(vectors[0]).toEqual([0, 1, 0]);
  });

  it('satisfies A·v = λ·v for every pair', () => {
    fc.assert(
      fc.property(symmetric, (m) => {
        const { values, vectors } = symmetricEigen(m, size);
        return vectors.every((v, k) => {
          const av = multiplyVector(m, v);
          const lambda = values[k] ?? Number.NaN;
          return av.every((x, i) => Math.abs(x - lambda * (v[i] ?? 0)) < 1e-8);
        });
      }),
    );
  });

  it('returns orthonormal eigenvectors and ascending eigenvalues', () => {
    fc.assert(
      fc.property(symmetric, (m) => {
        const { values, vectors } = symmetricEigen(m, size);
        const dot = (a: readonly number[], b: readonly number[]) =>
          a.reduce((s, x, i) => s + x * (b[i] ?? 0), 0);
        const orthonormal = vectors.every((a, i) =>
          vectors.every((b, j) => Math.abs(dot(a, b) - (i === j ? 1 : 0)) < 1e-9),
        );
        const ascending = values.every((v, i) => i === 0 || v >= (values[i - 1] ?? v));
        return orthonormal && ascending;
      }),
    );
  });

  it('reads out-of-range entries as NaN', () => {
    expect(entry(new Float64Array(1), 5)).toBeNaN();
  });
});
