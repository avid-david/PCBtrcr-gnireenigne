import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { drawnViaSize, VIA_PAD_MAX_MM, VIA_PAD_MIN_MM } from './viaSize';

const DEFAULTS = { drillMm: 0.3, padMm: 0.6 };
const radius = fc.double({ min: 0, max: 20, noNaN: true });
const positive = fc.double({ min: 0.01, max: 20, noNaN: true });
const SEED = { seed: 7 };

describe('drawnViaSize', () => {
  it('a drawn pad is twice the drag distance, clamped', () => {
    fc.assert(
      fc.property(radius, (r) => {
        const expected = Math.min(VIA_PAD_MAX_MM, Math.max(VIA_PAD_MIN_MM, 2 * r));
        expect(drawnViaSize(DEFAULTS, r).padMm).toBe(expected);
      }),
      SEED,
    );
  });

  it('the drill is whole hundredths of a mm, at least 0.01 and smaller than the pad', () => {
    fc.assert(
      fc.property(positive, positive, radius, (drillMm, padMm, r) => {
        const size = drawnViaSize({ drillMm, padMm }, r);
        const hundredths = size.drillMm * 100;
        expect(Math.abs(hundredths - Math.round(hundredths))).toBeLessThan(1e-9);
        expect(size.drillMm).toBeGreaterThanOrEqual(0.01);
        expect(size.drillMm).toBeLessThan(size.padMm);
      }),
      SEED,
    );
  });

  it('keeps the smallest via drillable and its drill below the pad', () => {
    expect(drawnViaSize({ drillMm: 0.6, padMm: 0.6 }, 0)).toEqual({ padMm: 0.1, drillMm: 0.09 });
    expect(drawnViaSize({ drillMm: 0.001, padMm: 1 }, 0)).toEqual({ padMm: 0.1, drillMm: 0.01 });
    expect(drawnViaSize({ drillMm: 0.95, padMm: 1 }, 0.0615)).toEqual({
      padMm: 0.123,
      drillMm: 0.12,
    });
  });
});
