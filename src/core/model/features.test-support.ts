import type { Vec2 } from '../geometry/vec2';
import type { ConnectionPoint, Feature, Hole, Pad, Trace, TraceVertex, Via } from './features';
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
