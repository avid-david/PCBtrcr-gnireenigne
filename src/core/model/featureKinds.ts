import { distance, rectDistance, segmentDistance } from '../geometry/distance';
import { boundsOfPoints, type Rect } from '../geometry/rect';
import { add, type Vec2 } from '../geometry/vec2';
import { anchorPosition } from './anchors';
import type { Feature, FeatureKindName, Trace, TraceVertex } from './features';
import type { LayerId, Project } from './project';

/**
 * Behaviour of one feature kind. Register new kinds here; nothing else switches on `kind`
 * (rendering and the inspector have their own registries).
 */
interface FeatureKind<F extends Feature> {
  /** Whether the feature exists on the layer (`null`-layer features exist on all layers). */
  onLayer(f: F, layerId: LayerId): boolean;
  /** Bounding box in board mm. */
  bounds(f: F, project: Project): Rect;
  /** Distance from `p` to the feature's copper (0 inside). */
  distanceTo(f: F, p: Vec2, project: Project): number;
  /** The feature moved by `delta`; bound trace vertices stay tied to their anchors. */
  translate(f: F, delta: Vec2): F;
}

const square = (at: Vec2, half: { x: number; y: number }): Rect => ({
  minX: at.x - half.x,
  minY: at.y - half.y,
  maxX: at.x + half.x,
  maxY: at.y + half.y,
});

/** Positions of a trace's vertices (bound ones resolved through their anchors). */
export function tracePoints(trace: Trace, project: Project): Vec2[] {
  return trace.vertices.flatMap((v) => {
    const at = v.kind === 'free' ? v.at : anchorPosition(project, v.anchor);
    return at === null ? [] : [at];
  });
}

const moveVertex = (v: TraceVertex, delta: Vec2): TraceVertex =>
  v.kind === 'free' ? { ...v, at: add(v.at, delta) } : v;

const circle = <F extends Feature & { at: Vec2 }>(radius: (f: F) => number) => ({
  bounds: (f: F) => square(f.at, { x: radius(f), y: radius(f) }),
  distanceTo: (f: F, p: Vec2) => Math.max(0, distance(p, f.at) - radius(f)),
  translate: (f: F, delta: Vec2) => ({ ...f, at: add(f.at, delta) }),
});

const traceKind: FeatureKind<Trace> = {
  onLayer: (f, layerId) => f.layerId === layerId,
  bounds: (f, project) => {
    const r = boundsOfPoints(tracePoints(f, project)) ?? square({ x: 0, y: 0 }, { x: 0, y: 0 });
    const w = f.widthMm / 2;
    return { minX: r.minX - w, minY: r.minY - w, maxX: r.maxX + w, maxY: r.maxY + w };
  },
  distanceTo: (f, p, project) => {
    const points = tracePoints(f, project);
    const segments = points.slice(1).map((b, i) => segmentDistance(p, points[i] ?? b, b));
    const nearest = Math.min(...segments, ...points.map((q) => distance(p, q)));
    return Math.max(0, nearest - f.widthMm / 2);
  },
  translate: (f, delta) => ({ ...f, vertices: f.vertices.map((v) => moveVertex(v, delta)) }),
};

const kinds: { readonly [K in FeatureKindName]: FeatureKind<Extract<Feature, { kind: K }>> } = {
  trace: traceKind,
  via: { onLayer: () => true, ...circle((f) => f.padMm / 2) },
  hole: { onLayer: () => true, ...circle((f) => f.diameterMm / 2) },
  point: { onLayer: (f, layerId) => f.layerId === layerId, ...circle((f) => f.diameterMm / 2) },
  pad: {
    onLayer: (f, layerId) => f.layerId === null || f.layerId === layerId,
    bounds: (f) => square(f.at, { x: f.widthMm / 2, y: f.heightMm / 2 }),
    distanceTo: (f, p) => rectDistance(p, square(f.at, { x: f.widthMm / 2, y: f.heightMm / 2 })),
    translate: (f, delta) => ({ ...f, at: add(f.at, delta) }),
  },
};

const kindOf = (f: Feature) => kinds[f.kind] as FeatureKind<Feature>;

/** Whether the feature exists on the layer. */
export const featureOnLayer = (f: Feature, layerId: LayerId): boolean =>
  kindOf(f).onLayer(f, layerId);

/** Whether the feature exists on every layer (vias, holes, through-hole pads). */
export const onAllLayers = (f: Feature, project: Project): boolean =>
  project.layers.every((l) => featureOnLayer(f, l.id));

/** Bounding box of the feature in board mm. */
export const featureBounds = (f: Feature, project: Project): Rect => kindOf(f).bounds(f, project);

/** Distance from a board point to the feature's copper (0 inside). */
export const featureDistance = (f: Feature, p: Vec2, project: Project): number =>
  kindOf(f).distanceTo(f, p, project);

/** The feature moved by `delta`. */
export const translateFeature = (f: Feature, delta: Vec2): Feature => kindOf(f).translate(f, delta);
