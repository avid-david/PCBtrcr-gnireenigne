import type { Vec2 } from '../geometry/vec2';
import type {
  Component,
  ConnectionPoint,
  Feature,
  Hole,
  Pad,
  Plane,
  Trace,
  TraceVertex,
  Via,
} from './features';
import { createProject, type Project } from './project';

// Builders for feature tests. Ids are given explicitly so tests read like the board they draw.

export const via = (id: string, at: Vec2): Via => ({
  kind: 'via',
  id,
  at,
  drillMm: 0.3,
  padMm: 0.6,
});

export const smdPad = (id: string, at: Vec2, layerId = 'top'): Pad => ({
  kind: 'pad',
  id,
  at,
  shape: 'rect',
  widthMm: 1,
  heightMm: 0.6,
  layerId,
  drillMm: 0,
});

export const thPad = (id: string, at: Vec2): Pad => ({
  kind: 'pad',
  id,
  at,
  shape: 'round',
  widthMm: 1.7,
  heightMm: 1.7,
  layerId: null,
  drillMm: 1,
});

export const hole = (id: string, at: Vec2, plated: boolean): Hole => ({
  kind: 'hole',
  id,
  at,
  diameterMm: 1,
  plated,
});

export const testPoint = (id: string, at: Vec2, layerId = 'top'): ConnectionPoint => ({
  kind: 'point',
  id,
  at,
  layerId,
  diameterMm: 0.8,
});

export const free = (id: string, at: Vec2): TraceVertex => ({ id, kind: 'free', at });
export const bound = (id: string, anchor: string): TraceVertex => ({ id, kind: 'bound', anchor });

export const trace = (id: string, vertices: TraceVertex[], layerId = 'top'): Trace => ({
  kind: 'trace',
  id,
  layerId,
  widthMm: 0.25,
  vertices,
});

export const withFeatures = (features: Feature[]): Project => ({ ...createProject(), features });

/** A component with SMD pads "1" and "2" at x = ∓1 (ids `<id>.1`, `<id>.2`) and a 3 × 1 mm body. */
export const twoPadComponent = (
  id: string,
  at: Vec2,
  options: { layerId?: string; flipped?: boolean; rotationDeg?: number; drillMm?: number } = {},
): Component => ({
  kind: 'component',
  id,
  layerId: options.layerId ?? 'top',
  flipped: options.flipped ?? false,
  at,
  rotationDeg: options.rotationDeg ?? 0,
  designator: 'R1',
  value: '10k',
  footprint: { id: 'chip', name: 'Chip_0805', params: { size: '0805' } },
  pads: ['1', '2'].map((number, i) => ({
    id: `${id}.${number}`,
    number,
    at: { x: i === 0 ? -1 : 1, y: 0 },
    shape: 'rect' as const,
    widthMm: 1,
    heightMm: 1.4,
    drillMm: options.drillMm ?? 0,
  })),
  outline: [
    [
      { x: -1.5, y: -0.5 },
      { x: 1.5, y: -0.5 },
      { x: 1.5, y: 0.5 },
      { x: -1.5, y: 0.5 },
      { x: -1.5, y: -0.5 },
    ],
  ],
});

export const plane = (id: string, outline: Vec2[], attached: string[] = []): Plane => ({
  kind: 'plane',
  id,
  layerId: 'top',
  outline,
  attached,
});

export const square = (minX: number, minY: number, size: number): Vec2[] => [
  { x: minX, y: minY },
  { x: minX + size, y: minY },
  { x: minX + size, y: minY + size },
  { x: minX, y: minY + size },
];
