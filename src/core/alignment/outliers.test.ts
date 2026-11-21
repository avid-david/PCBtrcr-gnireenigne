import { describe, expect, it } from 'vitest';
import { apply } from '../geometry/mat3';
import type { Vec2 } from '../geometry/vec2';
import { BOTTOM_TRUTH } from './fixtures.test-support';
import { FALSE_ALARM_RATE, fQuantile, outlierFlags } from './outliers';

const FEATURES: Vec2[] = [
  { x: 10, y: 8 },
  { x: 70, y: 9 },
  { x: 68, y: 42 },
  { x: 12, y: 44 },
  { x: 40, y: 25 },
  { x: 25, y: 30 },
  { x: 55, y: 15 },
  { x: 35, y: 40 },
  { x: 60, y: 30 },
  { x: 20, y: 18 },
];

/** Bottom-photo clicks mapped to the board, with a small deterministic error and one bad point. */
function pairs(count: number, bad?: { index: number; px: number }) {
  return FEATURES.slice(0, count).map((boardMm, i) => {
    const px = apply(BOTTOM_TRUTH, boardMm);
    const wobble = ((i * 7) % 5) / 5 - 0.4;
    const extra = i === bad?.index ? bad.px : 0;
    return { from: { x: px.x + wobble + extra, y: px.y - wobble }, to: boardMm };
  });
}

describe('fQuantile', () => {
  it('matches tabulated F(2, ν) critical values', () => {
    expect(fQuantile(2, 0.01)).toBeCloseTo(99, 6);
    expect(fQuantile(4, 0.05)).toBeCloseTo(6.944, 3);
    expect(fQuantile(10, 0.01)).toBeCloseTo(7.559, 3);
  });
});

describe('outlierFlags', () => {
  it('flags nothing when all clicks are good', () => {
    expect(outlierFlags(pairs(8)).some(Boolean)).toBe(false);
  });

  it('cannot judge fewer than 6 points', () => {
    expect(outlierFlags(pairs(5, { index: 2, px: 200 }))).toEqual([
      false,
      false,
      false,
      false,
      false,
    ]);
  });

  it('flags exactly the mis-clicked point, also among only 6', () => {
    const flags = outlierFlags(pairs(8, { index: 2, px: 40 }));
    expect(flags.map((f, i) => (f ? i : -1)).filter((i) => i >= 0)).toEqual([2]);
    expect(outlierFlags(pairs(6, { index: 4, px: 80 }))).toEqual([
      false,
      false,
      false,
      false,
      true,
      false,
    ]);
  });

  it('with two mis-clicks at once, flags the second as soon as the first is fixed', () => {
    // Two bad points can mask each other (each inflates the noise estimate for the other);
    // the RMS still exposes the problem, and fixing one reveals the other.
    const bad = new Set([1, 6]);
    const twoBad = pairs(10).map((p, i) =>
      bad.has(i) ? { from: { x: p.from.x + 60, y: p.from.y - 30 }, to: p.to } : p,
    );
    const fixedFirst = twoBad.filter((_, i) => i !== 1);
    expect(
      outlierFlags(fixedFirst)
        .map((f, i) => (f ? i : -1))
        .filter((i) => i >= 0),
    ).toEqual([5]);
  });

  it('ignores disagreements smaller than 0.1 mm', () => {
    expect(outlierFlags(pairs(8, { index: 3, px: 2 })).some(Boolean)).toBe(false);
  });

  it('uses a 1 % false-alarm budget', () => {
    expect(FALSE_ALARM_RATE).toBe(0.01);
  });
});
