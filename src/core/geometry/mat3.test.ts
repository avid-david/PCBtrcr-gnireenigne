import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { unwrapOr } from '../result';
import { affine, closeTo, point } from './arbitraries.test-support';
import {
  IDENTITY,
  apply,
  compose,
  determinant,
  invert,
  multiply,
  scaling,
  translation,
  type Mat3,
} from './mat3';

describe('Mat3', () => {
  it('identity leaves every point unchanged', () => {
    fc.assert(fc.property(point, (p) => closeTo(apply(IDENTITY, p), p)));
  });

  it('translation and scaling move points as expected', () => {
    expect(apply(translation(2, -3), { x: 1, y: 1 })).toEqual({ x: 3, y: -2 });
    expect(apply(scaling(2, 3), { x: 1, y: 1 })).toEqual({ x: 2, y: 3 });
  });

  it('compose applies steps in the order given', () => {
    const scaleThenMove = compose(scaling(2, 2), translation(1, 0));
    expect(apply(scaleThenMove, { x: 1, y: 1 })).toEqual({ x: 3, y: 2 });
  });

  it('applying a product equals applying both factors (b first)', () => {
    fc.assert(
      fc.property(affine, affine, point, (a, b, p) =>
        closeTo(apply(multiply(a, b), p), apply(a, apply(b, p)), 1e-3),
      ),
    );
  });

  it('a transform composed with its inverse is the identity', () => {
    fc.assert(
      fc.property(affine, point, (m, p) => {
        const inverse = unwrapOr(invert(m), IDENTITY);
        return closeTo(apply(inverse, apply(m, p)), p, 1e-6);
      }),
    );
  });

  it('inverts projective matrices too', () => {
    const projective: Mat3 = [1, 0.2, 3, 0.1, 1, -2, 0.001, 0.002, 1];
    const inverse = unwrapOr(invert(projective), IDENTITY);
    const p = { x: 10, y: 20 };
    expect(closeTo(apply(inverse, apply(projective, p)), p)).toBe(true);
  });

  it('reports singular matrices instead of throwing', () => {
    expect(invert(scaling(0, 1))).toEqual({ ok: false, error: 'singular' });
  });

  it('determinant is multiplicative', () => {
    fc.assert(
      fc.property(affine, affine, (a, b) => {
        const expected = determinant(a) * determinant(b);
        return (
          Math.abs(determinant(multiply(a, b)) - expected) <= 1e-6 * Math.max(1, Math.abs(expected))
        );
      }),
    );
  });
});
