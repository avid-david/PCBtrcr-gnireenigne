import type { PadShape } from '../model/features';
import {
  boxOutline,
  centred,
  mm,
  type Footprint,
  type FootprintFamily,
  type FootprintPad,
  type Params,
} from './footprint';

// Parametric footprint families (SPEC F4). Land patterns follow IPC-7351B nominal density, as
// published in the KiCad footprint library; docs/adr/0007 lists the sources.

const num = (params: Params, name: string): number => Number(params[name]);

const pad = (number: number, at: { x: number; y: number }, size: PadSize): FootprintPad => ({
  number: String(number),
  at: { x: mm(at.x), y: mm(at.y) },
  shape: size.shape(number),
  widthMm: size.widthMm,
  heightMm: size.heightMm,
  drillMm: size.drillMm,
});

interface PadSize {
  readonly widthMm: number;
  readonly heightMm: number;
  readonly drillMm: number;
  readonly shape: (number: number) => PadShape;
}

const pin1Square = (round: PadShape) => (n: number) => (n === 1 ? 'rect' : round);

/** Pin header sizes per pitch: square pad, drill. */
const HEADERS: Readonly<Record<string, { readonly padMm: number; readonly drillMm: number }>> = {
  '2.54': { padMm: 1.7, drillMm: 1 },
  '2.00': { padMm: 1.35, drillMm: 0.8 },
  '1.27': { padMm: 1, drillMm: 0.65 },
};

/** 1×N or 2×N header. Pins count across each row first, as on real 2-row headers. */
function pinHeader(params: Params): Footprint {
  const rows = num(params, 'rows');
  const perRow = num(params, 'pins');
  const pitchName = String(params.pitch);
  const pitch = Number(pitchName);
  const size = HEADERS[pitchName] ?? { padMm: 1.7, drillMm: 1 };
  const padSize = {
    widthMm: size.padMm,
    heightMm: size.padMm,
    drillMm: size.drillMm,
    shape: pin1Square('round'),
  };
  // Rows of the header run down the page; pins are numbered across them (1 2 / 3 4 / …).
  const xs = centred(rows, pitch);
  const pads = centred(perRow, pitch).flatMap((y, i) =>
    xs.map((x, j) => pad(i * rows + j + 1, { x, y }, padSize)),
  );
  return {
    name: `PinHeader_${String(rows)}x${String(perRow).padStart(2, '0')}_P${pitchName}mm`,
    pads,
    outline: [boxOutline(rows * pitch, perRow * pitch, pitch / 2)],
  };
}

/** Chip resistor/capacitor land patterns: pad centre x, pad size, body size (KiCad R_*Metric). */
const CHIPS: Readonly<
  Record<
    string,
    { readonly x: number; readonly pad: [number, number]; readonly body: [number, number] }
  >
> = {
  '0201': { x: 0.32, pad: [0.46, 0.4], body: [0.6, 0.3] },
  '0402': { x: 0.51, pad: [0.54, 0.64], body: [1.05, 0.54] },
  '0603': { x: 0.825, pad: [0.8, 0.95], body: [1.6, 0.825] },
  '0805': { x: 0.9125, pad: [1.025, 1.4], body: [2, 1.25] },
  '1206': { x: 1.4625, pad: [1.125, 1.75], body: [3.2, 1.6] },
  '1210': { x: 1.4625, pad: [1.125, 2.65], body: [3.2, 2.49] },
  '2512': { x: 2.9625, pad: [1.225, 3.35], body: [6.3, 3.2] },
};

/** In size order; object keys would put "1206" before "0201" (integer-like keys sort first). */
const CHIP_SIZES = ['0201', '0402', '0603', '0805', '1206', '1210', '2512'];

const METRIC: Readonly<Record<string, string>> = {
  '0201': '0603',
  '0402': '1005',
  '0603': '1608',
  '0805': '2012',
  '1206': '3216',
  '1210': '3225',
  '2512': '6332',
};

function chip(params: Params): Footprint {
  const sizeName = String(params.size);
  const c = CHIPS[sizeName] ?? { x: 0.9125, pad: [1.025, 1.4], body: [2, 1.25] };
  const padSize = {
    widthMm: c.pad[0],
    heightMm: c.pad[1],
    drillMm: 0,
    shape: () => 'rect' as const,
  };
  return {
    name: `Chip_${sizeName}_${METRIC[sizeName] ?? ''}Metric`,
    pads: [pad(1, { x: -c.x, y: 0 }, padSize), pad(2, { x: c.x, y: 0 }, padSize)],
    outline: [boxOutline(c.body[0], c.body[1])],
  };
}

interface DualRow {
  readonly pins: number;
  readonly pitch: number;
  /** Pad centre distance from the middle, across the rows. */
  readonly rowX: number;
  readonly pad: PadSize;
}

/** Dual-row package: pin 1 top left, counting down the left row and back up the right. */
function dualRow(d: DualRow): Footprint['pads'] {
  const ys = centred(d.pins / 2, d.pitch);
  const left = ys.map((y, i) => pad(i + 1, { x: -d.rowX, y }, d.pad));
  const right = [...ys].reverse().map((y, i) => pad(d.pins / 2 + i + 1, { x: d.rowX, y }, d.pad));
  return [...left, ...right];
}

const smdPad = (widthMm: number, heightMm: number): PadSize => ({
  widthMm,
  heightMm,
  drillMm: 0,
  shape: () => 'rect',
});

const soic = (params: Params): Footprint => {
  const pins = num(params, 'pins');
  const d = { pins, pitch: 1.27, rowX: 2.475, pad: smdPad(1.95, 0.6) };
  const length = (pins / 2) * 1.27 + 0.1;
  return {
    name: `SOIC-${String(pins)}_P1.27mm`,
    pads: dualRow(d),
    outline: [boxOutline(3.9, mm(length), 0.8)],
  };
};

const tssop = (params: Params): Footprint => {
  const pins = num(params, 'pins');
  const d = { pins, pitch: 0.65, rowX: 2.875, pad: smdPad(1.55, 0.4) };
  return {
    name: `TSSOP-${String(pins)}_4.4mm_P0.65mm`,
    pads: dualRow(d),
    outline: [boxOutline(4.4, mm((pins / 2) * 0.65 + 0.45), 0.8)],
  };
};

const dip = (params: Params): Footprint => {
  const pins = num(params, 'pins');
  const padSize = { widthMm: 1.6, heightMm: 1.6, drillMm: 0.8, shape: pin1Square('round') };
  const d = { pins, pitch: 2.54, rowX: 3.81, pad: padSize };
  return {
    name: `DIP-${String(pins)}_W7.62mm`,
    pads: dualRow(d),
    outline: [boxOutline(6.35, mm((pins / 2) * 2.54), 1)],
  };
};

/** Unknown part: rows × columns of identical pads, numbered row by row. */
const padGrid = (params: Params): Footprint => {
  const [rows, columns, pitch, padMm, drillMm] = ['rows', 'columns', 'pitch', 'pad', 'drill'].map(
    (name) => num(params, name),
  ) as [number, number, number, number, number];
  const shape = drillMm > 0 ? pin1Square('round') : () => 'rect' as const;
  const padSize = { widthMm: padMm, heightMm: padMm, drillMm, shape };
  const xs = centred(columns, pitch);
  const pads = centred(rows, pitch).flatMap((y, r) =>
    xs.map((x, c) => pad(r * columns + c + 1, { x, y }, padSize)),
  );
  return {
    name: `PadGrid_${String(rows)}x${String(columns)}_P${String(pitch)}mm`,
    pads,
    outline: [boxOutline(mm(columns * pitch), mm(rows * pitch), mm(pitch / 2))],
  };
};

const evenPins = (options: readonly number[]) => ({
  kind: 'choice' as const,
  name: 'pins',
  label: 'Pins',
  options: options.map(String),
  default: String(options[0]),
});

/** The parametric families, in library order. */
export const FAMILIES: readonly FootprintFamily[] = [
  {
    id: 'pin-header',
    label: 'Pin header',
    prefix: 'J',
    params: [
      { kind: 'choice', name: 'rows', label: 'Rows', options: ['1', '2'], default: '1' },
      {
        kind: 'integer',
        name: 'pins',
        label: 'Pins per row',
        min: 1,
        max: 40,
        step: 1,
        default: 4,
      },
      {
        kind: 'choice',
        name: 'pitch',
        label: 'Pitch (mm)',
        options: ['2.54', '2.00', '1.27'],
        default: '2.54',
      },
    ],
    generate: pinHeader,
  },
  {
    id: 'chip',
    label: 'Chip resistor / capacitor',
    prefix: 'R',
    params: [
      {
        kind: 'choice',
        name: 'size',
        label: 'Size (inch)',
        options: CHIP_SIZES,
        default: '0805',
      },
    ],
    generate: chip,
  },
  {
    id: 'soic',
    label: 'SOIC (1.27 mm)',
    prefix: 'U',
    params: [evenPins([8, 14, 16])],
    generate: soic,
  },
  {
    id: 'tssop',
    label: 'TSSOP (0.65 mm)',
    prefix: 'U',
    params: [evenPins([8, 14, 16, 20, 24, 28])],
    generate: tssop,
  },
  {
    id: 'dip',
    label: 'DIP (2.54 mm, 7.62 mm rows)',
    prefix: 'U',
    params: [evenPins([4, 6, 8, 14, 16, 18, 20, 24, 28, 40])],
    generate: dip,
  },
  {
    id: 'pad-grid',
    label: 'Pad grid (unknown part)',
    prefix: 'U',
    params: [
      { kind: 'integer', name: 'rows', label: 'Rows', min: 1, max: 40, step: 1, default: 2 },
      { kind: 'integer', name: 'columns', label: 'Columns', min: 1, max: 40, step: 1, default: 4 },
      { kind: 'number', name: 'pitch', label: 'Pitch (mm)', min: 0.2, max: 20, default: 2.54 },
      { kind: 'number', name: 'pad', label: 'Pad size (mm)', min: 0.1, max: 10, default: 1.7 },
      { kind: 'number', name: 'drill', label: 'Drill (mm, 0 = SMD)', min: 0, max: 10, default: 1 },
    ],
    generate: padGrid,
  },
];
