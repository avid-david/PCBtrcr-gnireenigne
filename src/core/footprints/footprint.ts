import type { Vec2 } from '../geometry/vec2';
import type { PadShape } from '../model/features';

// Footprints (SPEC F4) are plain data: pads and a silkscreen outline, in mm, relative to the
// footprint's centre and seen from the side the part is mounted on. Fixed parts are JSON files
// (parts/), families are parametric generators; both are registered in library.ts.

export interface FootprintPad {
  /** Pin number or name as printed in datasheets ("1", "A3"); unique within a footprint. */
  readonly number: string;
  readonly at: Vec2;
  readonly shape: PadShape;
  readonly widthMm: number;
  readonly heightMm: number;
  /** Drill diameter; 0 for a surface-mount pad. */
  readonly drillMm: number;
}

export interface Footprint {
  /** Descriptive name, e.g. "PinHeader_2x05_P2.54mm". */
  readonly name: string;
  readonly pads: readonly FootprintPad[];
  /** Silkscreen polylines; a closed shape repeats its first point at the end. */
  readonly outline: readonly (readonly Vec2[])[];
}

/** One parameter of a footprint family, described so the UI can build a form for it. */
export type ParamSpec =
  | {
      readonly kind: 'integer';
      readonly name: string;
      readonly label: string;
      readonly min: number;
      readonly max: number;
      readonly step: number;
      readonly default: number;
    }
  | {
      readonly kind: 'number';
      readonly name: string;
      readonly label: string;
      readonly min: number;
      readonly max: number;
      readonly default: number;
    }
  | {
      readonly kind: 'choice';
      readonly name: string;
      readonly label: string;
      readonly options: readonly string[];
      readonly default: string;
    };

export type ParamValue = number | string;
export type Params = Readonly<Record<string, ParamValue>>;

/** A registered footprint: a fixed part (no parameters) or a parametric family. */
export interface FootprintFamily {
  readonly id: string;
  readonly label: string;
  /** Default designator prefix for parts of this family (R, J, U…). */
  readonly prefix: string;
  readonly params: readonly ParamSpec[];
  /** Builds the footprint; `params` has already been checked against `params`. */
  generate(params: Params): Footprint;
}

/** A rectangle outline centred on the origin; `chamfer` cuts the top-left corner (pin 1). */
export function boxOutline(widthMm: number, heightMm: number, chamfer = 0): Vec2[] {
  const x = widthMm / 2;
  const y = heightMm / 2;
  const start = chamfer > 0 ? [{ x: -x, y: -y + chamfer }] : [];
  return [
    ...start,
    { x: -x + chamfer, y: -y },
    { x, y: -y },
    { x, y },
    { x: -x, y },
    start[0] ?? { x: -x, y: -y },
  ];
}

/** Positions of `count` items at `pitch`, centred on 0. */
export const centred = (count: number, pitch: number): number[] =>
  Array.from({ length: count }, (_, i) => (i - (count - 1) / 2) * pitch);

/** Rounds away floating-point noise (e.g. 2.5400000000000005) so files stay readable. */
export const mm = (value: number): number => Math.round(value * 1e6) / 1e6 + 0;
