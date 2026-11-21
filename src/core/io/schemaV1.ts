import { z } from 'zod';
import { CORNERS } from '../model/project';

// The project file format, version 1 (docs/adr/0006). It describes `project.json` inside a
// `.pcbrt` archive. Never change a released version: add a new one and a migration instead.

const finite = z.number().refine(Number.isFinite, 'must be a finite number');
const positive = finite.refine((v) => v > 0, 'must be greater than 0');
const nonNegative = finite.refine((v) => v >= 0, 'must not be negative');
const id = z.string().min(1);

const vec2 = z.object({ x: finite, y: finite });

const image = z.object({
  id,
  fileName: z.string(),
  mimeType: z.string(),
  widthPx: positive,
  heightPx: positive,
});

const layer = z.object({
  id,
  name: z.string(),
  side: z.enum(['top', 'bottom']),
  image: image.nullable(),
  mirrored: z.boolean(),
  corners: z.partialRecord(z.enum(CORNERS), vec2),
});

const match = z.object({ id, points: z.record(z.string(), vec2) });

const vertex = z.discriminatedUnion('kind', [
  z.object({ id, kind: z.literal('free'), at: vec2 }),
  z.object({ id, kind: z.literal('bound'), anchor: id }),
]);

export const featureV1 = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('trace'),
    id,
    layerId: id,
    widthMm: positive,
    vertices: z.array(vertex).min(2),
  }),
  z.object({ kind: z.literal('via'), id, at: vec2, drillMm: nonNegative, padMm: positive }),
  z.object({ kind: z.literal('hole'), id, at: vec2, diameterMm: positive, plated: z.boolean() }),
  z.object({
    kind: z.literal('pad'),
    id,
    at: vec2,
    shape: z.enum(['round', 'rect', 'oval']),
    widthMm: positive,
    heightMm: positive,
    layerId: id.nullable(),
    drillMm: nonNegative,
  }),
  z.object({ kind: z.literal('point'), id, at: vec2, layerId: id, diameterMm: positive }),
]);

export const projectV1 = z.object({
  board: z.object({ widthMm: positive, heightMm: positive }).nullable(),
  layers: z.array(layer).min(1),
  matches: z.array(match),
  features: z.array(featureV1),
});

export const documentV1 = z.object({
  schemaVersion: z.literal(1),
  project: projectV1,
});

export type DocumentV1 = z.infer<typeof documentV1>;
