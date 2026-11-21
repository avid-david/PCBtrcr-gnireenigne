import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { FAMILIES } from './families';
import type { Footprint, FootprintFamily, ParamSpec, Params } from './footprint';
import {
  FOOTPRINT_LIBRARY,
  footprintSchema,
  generateFootprint,
  loadParts,
  PART_FILES,
} from './library';

const paramValue = (spec: ParamSpec): fc.Arbitrary<number | string> => {
  if (spec.kind === 'integer') {
    return fc.integer({ min: spec.min, max: spec.max });
  }
  if (spec.kind === 'number') {
    return fc.double({ min: spec.min, max: spec.max, noNaN: true });
  }
  return fc.constantFrom(...spec.options);
};

const paramsOf = (family: FootprintFamily): fc.Arbitrary<Params> =>
  fc.record(Object.fromEntries(family.params.map((p) => [p.name, paramValue(p)])));

const footprints = (
  family: FootprintFamily,
): fc.Arbitrary<{ params: Params; footprint: Footprint }> =>
  paramsOf(family).map((params) => ({ params, footprint: family.generate(params) }));

const mean = (values: number[]) => values.reduce((s, v) => s + v, 0) / values.length;

/** How many pins each family must produce for its parameters. */
const expectedPins: Readonly<Record<string, (p: Params) => number>> = {
  'pin-header': (p) => Number(p.rows) * Number(p.pins),
  chip: () => 2,
  soic: (p) => Number(p.pins),
  tssop: (p) => Number(p.pins),
  dip: (p) => Number(p.pins),
  'pad-grid': (p) => Number(p.rows) * Number(p.columns),
};

describe('footprint families', () => {
  it.each(FAMILIES.map((f) => [f.id, f] as const))(
    '%s: pins 1…N once each, centred, valid against the schema',
    (id, family) => {
      fc.assert(
        fc.property(footprints(family), ({ params, footprint }) => {
          const numbers = footprint.pads.map((p) => Number(p.number));
          const n = expectedPins[id]?.(params) ?? -1;
          expect(numbers).toEqual(Array.from({ length: n }, (_, i) => i + 1));
          expect(mean(footprint.pads.map((p) => p.at.x))).toBeCloseTo(0, 6);
          expect(mean(footprint.pads.map((p) => p.at.y))).toBeCloseTo(0, 6);
          expect(footprintSchema.safeParse(footprint).success).toBe(true);
        }),
        { numRuns: 40 },
      );
    },
  );

  it('pin headers are spaced at their pitch and count across rows', () => {
    const header = generateFootprint('pin-header', { rows: '2', pins: 5, pitch: '2.00' });
    const pads = header.ok ? header.value.pads : [];
    const at = (n: number) => pads[n - 1]?.at ?? { x: NaN, y: NaN };
    expect(at(2).x - at(1).x).toBeCloseTo(2);
    expect(at(3).y - at(1).y).toBeCloseTo(2);
    expect(pads[0]?.shape).toBe('rect');
    expect(pads[1]?.shape).toBe('round');
    expect(header.ok && header.value.name).toBe('PinHeader_2x05_P2.00mm');
  });

  it('dual-row packages count down the left row and back up the right', () => {
    fc.assert(
      fc.property(fc.constantFrom('soic', 'tssop', 'dip'), (id) => {
        const result = generateFootprint(id);
        const pads = result.ok ? result.value.pads : [];
        const at = (i: number) => pads[i]?.at ?? { x: NaN, y: NaN };
        pads.forEach((p, i) => {
          expect(at(pads.length - 1 - i).y).toBeCloseTo(p.at.y);
          expect(at(pads.length - 1 - i).x).toBeCloseTo(-p.at.x);
        });
        expect(at(0).x).toBeLessThan(0);
        expect(at(1).y).toBeGreaterThan(at(0).y);
      }),
    );
  });

  it('chip land patterns match the IPC-7351B nominal table', () => {
    const r0805 = generateFootprint('chip', { size: '0805' });
    expect(r0805.ok && r0805.value.pads.map((p) => [p.at.x, p.widthMm, p.heightMm])).toEqual([
      [-0.9125, 1.025, 1.4],
      [0.9125, 1.025, 1.4],
    ]);
  });

  it('a pad grid with drill 0 is surface mount', () => {
    const grid = generateFootprint('pad-grid', { drill: 0 });
    expect(grid.ok && grid.value.pads.every((p) => p.drillMm === 0 && p.shape === 'rect')).toBe(
      true,
    );
  });
});

describe('footprint library', () => {
  it('loads every fixed part file', () => {
    const parts = loadParts(PART_FILES);
    expect(parts.ok && parts.value.map((p) => p.id)).toEqual([
      'sot-23-3',
      'sot-23-5',
      'sot-23-6',
      'to-92',
      'to-220-3',
    ]);
    expect(FOOTPRINT_LIBRARY).toHaveLength(FAMILIES.length + 5);
  });

  it('reports an invalid part file by name', () => {
    const parts = loadParts({
      'bad.json': {
        id: 'x',
        label: 'X',
        prefix: 'U',
        footprint: { name: 'X', pads: [], outline: [] },
      },
    });
    expect(parts).toMatchObject({ ok: false, error: { file: 'bad.json' } });
  });

  it('rejects duplicate pad numbers', () => {
    const pad = {
      number: '1',
      at: { x: 0, y: 0 },
      shape: 'round',
      widthMm: 1,
      heightMm: 1,
      drillMm: 0,
    };
    expect(footprintSchema.safeParse({ name: 'X', pads: [pad, pad], outline: [] }).success).toBe(
      false,
    );
  });

  it('generates with defaults and refuses unknown footprints or bad parameters', () => {
    expect(generateFootprint('to-92').ok).toBe(true);
    expect(generateFootprint('nope')).toEqual({
      ok: false,
      error: { kind: 'unknown-footprint', id: 'nope' },
    });
    expect(generateFootprint('pin-header', { pins: 41 })).toEqual({
      ok: false,
      error: { kind: 'invalid-param', name: 'pins' },
    });
    expect(generateFootprint('pad-grid', { pitch: Number.NaN }).ok).toBe(false);
    expect(generateFootprint('chip', { size: '9999' }).ok).toBe(false);
  });

  it('every fixed part has pin 1 and unique pads', () => {
    for (const family of FOOTPRINT_LIBRARY.filter((f) => f.params.length === 0)) {
      const footprint = family.generate({});
      expect(footprint.pads[0]?.number).toBe('1');
      expect(footprintSchema.safeParse(footprint).success).toBe(true);
    }
  });
});

describe('families called directly', () => {
  it('fall back to a standard size for values the form would never offer', () => {
    const chip = FAMILIES.find((f) => f.id === 'chip')?.generate({ size: '9999' });
    expect(chip?.pads[1]?.at.x).toBe(0.9125);
    const header = FAMILIES.find((f) => f.id === 'pin-header')?.generate({
      rows: '1',
      pins: 2,
      pitch: '3.00',
    });
    expect(header?.pads[0]?.widthMm).toBe(1.7);
  });

  it('checks every kind of parameter value', () => {
    const grid = findFamilyOrThrow('pad-grid');
    expect(generateFootprint(grid.id, { rows: 2.5 }).ok).toBe(false);
    expect(generateFootprint(grid.id, { pitch: '2' }).ok).toBe(false);
  });
});

function findFamilyOrThrow(id: string): FootprintFamily {
  const family = FOOTPRINT_LIBRARY.find((f) => f.id === id);
  if (family === undefined) {
    throw new Error(id);
  }
  return family;
}
