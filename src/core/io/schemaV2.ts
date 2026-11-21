import { z } from 'zod';
import { featureV1, projectV1 } from './schemaV1';

// The project file format, version 2 (docs/adr/0007): version 1 plus components, planes, text
// and silkscreen. Never change a released version: add a new one and a migration instead.

const finite = z.number().refine(Number.isFinite, 'must be a finite number');
const positive = finite.refine((v) => v > 0, 'must be greater than 0');
const nonNegative = finite.refine((v) => v >= 0, 'must not be negative');
const id = z.string().min(1);
const vec2 = z.object({ x: finite, y: finite });

const componentPad = z.object({
  id,
  number: z.string().min(1),
  at: vec2,
  shape: z.enum(['round', 'rect', 'oval']),
  widthMm: positive,
  heightMm: positive,
  drillMm: nonNegative,
});

const component = z.object({
  kind: z.literal('component'),
  id,
  layerId: id,
  flipped: z.boolean(),
  at: vec2,
  rotationDeg: finite,
  designator: z.string(),
  value: z.string(),
  footprint: z.object({
    id: z.string(),
    name: z.string(),
    params: z.record(z.string(), z.union([finite, z.string()])),
  }),
  pads: z
    .array(componentPad)
    .min(1)
    .refine((pads) => new Set(pads.map((p) => p.number)).size === pads.length, {
      message: 'pad numbers must be unique',
    }),
  outline: z.array(z.array(vec2).min(2)),
});

const plane = z.object({
  kind: z.literal('plane'),
  id,
  layerId: id,
  outline: z.array(vec2).min(3),
  attached: z.array(id),
});

const text = (kind: 'text' | 'silkText') =>
  z.object({
    kind: z.literal(kind),
    id,
    layerId: id,
    at: vec2,
    text: z.string(),
    heightMm: positive,
  });

const silkLine = z.object({
  kind: z.literal('silkLine'),
  id,
  layerId: id,
  points: z.array(vec2).min(2),
  widthMm: positive,
});

export const featureV2 = z.discriminatedUnion('kind', [
  ...featureV1.options,
  component,
  plane,
  text('text'),
  silkLine,
  text('silkText'),
]);

export const projectV2 = projectV1.extend({ features: z.array(featureV2) });

export const documentV2 = z.object({
  schemaVersion: z.literal(2),
  project: projectV2,
});
