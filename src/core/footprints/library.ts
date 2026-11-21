import { z } from 'zod';
import { err, ok, type Result } from '../result';
import { FAMILIES } from './families';
import type { Footprint, FootprintFamily, ParamSpec, Params, ParamValue } from './footprint';
import sot233 from './parts/sot-23-3.json';
import sot235 from './parts/sot-23-5.json';
import sot236 from './parts/sot-23-6.json';
import to220 from './parts/to-220-3.json';
import to92 from './parts/to-92.json';

const finite = z.number().refine(Number.isFinite);
const positive = finite.refine((v) => v > 0, 'must be greater than 0');
const vec2 = z.object({ x: finite, y: finite });

/** Schema of a footprint; fixed parts in parts/*.json must match it. */
export const footprintSchema = z
  .object({
    name: z.string().min(1),
    pads: z
      .array(
        z.object({
          number: z.string().min(1),
          at: vec2,
          shape: z.enum(['round', 'rect', 'oval']),
          widthMm: positive,
          heightMm: positive,
          drillMm: finite.refine((v) => v >= 0, 'must not be negative'),
        }),
      )
      .min(1),
    outline: z.array(z.array(vec2).min(2)),
  })
  .refine((f) => new Set(f.pads.map((p) => p.number)).size === f.pads.length, {
    message: 'pad numbers must be unique',
    path: ['pads'],
  });

/** A fixed part file: a footprint with its library entry. */
export const partSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  prefix: z.string().min(1),
  footprint: footprintSchema,
});

export interface PartError {
  readonly file: string;
  readonly message: string;
}

/** Turns part files into library entries; any invalid file is reported, not skipped silently. */
export function loadParts(
  files: Readonly<Record<string, unknown>>,
): Result<FootprintFamily[], PartError> {
  const families: FootprintFamily[] = [];
  for (const [file, data] of Object.entries(files)) {
    const part = partSchema.safeParse(data);
    if (!part.success) {
      const issue = part.error.issues[0];
      return err({ file, message: `${issue?.path.join('.') ?? ''}: ${issue?.message ?? ''}` });
    }
    const { footprint, ...entry } = part.data;
    families.push({ ...entry, params: [], generate: () => footprint });
  }
  return ok(families);
}

export const PART_FILES = {
  'sot-23-3.json': sot233,
  'sot-23-5.json': sot235,
  'sot-23-6.json': sot236,
  'to-92.json': to92,
  'to-220-3.json': to220,
};

const parts = loadParts(PART_FILES);

/** Every registered footprint, families first, then fixed parts. */
export const FOOTPRINT_LIBRARY: readonly FootprintFamily[] = [
  ...FAMILIES,
  ...(parts.ok ? parts.value : []),
];

/** A library entry by id. */
export const findFamily = (id: string): FootprintFamily | undefined =>
  FOOTPRINT_LIBRARY.find((f) => f.id === id);

/** Default value of every parameter. */
export const defaultParams = (family: FootprintFamily): Params =>
  Object.fromEntries(family.params.map((p) => [p.name, p.default]));

const validValue: {
  readonly [K in ParamSpec['kind']]: (
    spec: Extract<ParamSpec, { kind: K }>,
    v: ParamValue,
  ) => boolean;
} = {
  integer: (spec, v) => Number.isInteger(v) && Number(v) >= spec.min && Number(v) <= spec.max,
  number: (spec, v) =>
    typeof v === 'number' && Number.isFinite(v) && v >= spec.min && v <= spec.max,
  choice: (spec, v) => spec.options.includes(String(v)),
};

/** Whether a value is allowed for the parameter. */
export const isValidParam = (spec: ParamSpec, value: ParamValue): boolean =>
  (validValue[spec.kind] as (s: ParamSpec, v: ParamValue) => boolean)(spec, value);

export type FootprintError =
  | { readonly kind: 'unknown-footprint'; readonly id: string }
  | { readonly kind: 'invalid-param'; readonly name: string };

/** Builds a footprint from a library entry and parameters; missing parameters take defaults. */
export function generateFootprint(
  id: string,
  params: Params = {},
): Result<Footprint, FootprintError> {
  const family = findFamily(id);
  if (family === undefined) {
    return err({ kind: 'unknown-footprint', id });
  }
  const full = { ...defaultParams(family), ...params };
  const bad = family.params.find((spec) => !isValidParam(spec, full[spec.name] ?? ''));
  return bad === undefined
    ? ok(family.generate(full))
    : err({ kind: 'invalid-param', name: bad.name });
}
