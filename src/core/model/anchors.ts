import type { Vec2 } from '../geometry/vec2';
import { toBoard } from './component';
import type { AnchorId, Component, Feature, FeatureId, TraceVertex } from './features';
import type { LayerId, Project } from './project';

/** Where an anchor is and which layer it is on (`null`: every layer). */
export interface AnchorInfo {
  readonly id: AnchorId;
  readonly featureId: FeatureId;
  readonly layerId: LayerId | null;
  /** Own position; `null` for a bound trace vertex, whose position is its anchor's. */
  readonly at: Vec2 | null;
  /** For a bound trace vertex: the anchor it is tied to. */
  readonly boundTo: AnchorId | null;
}

const point = (f: Feature, layerId: LayerId | null, at: Vec2): AnchorInfo[] => [
  { id: f.id, featureId: f.id, layerId, at, boundTo: null },
];

const vertexInfo = (traceId: FeatureId, layerId: LayerId, v: TraceVertex): AnchorInfo =>
  v.kind === 'free'
    ? { id: v.id, featureId: traceId, layerId, at: v.at, boundTo: null }
    : { id: v.id, featureId: traceId, layerId, at: null, boundTo: v.anchor };

/** Each pad is its own anchor; surface-mount pads are on the component's layer. */
const componentPads = (c: Component): AnchorInfo[] =>
  c.pads.map((pad) => ({
    id: pad.id,
    featureId: c.id,
    layerId: pad.drillMm > 0 ? null : c.layerId,
    at: toBoard(c, pad.at),
    boundTo: null,
  }));

interface AnchorKind<F extends Feature> {
  /** The anchors the feature offers. */
  anchors(f: F): AnchorInfo[];
  /**
   * Groups of anchors the feature itself connects: a trace is one conductor, a plane joins what
   * is attached to it, a component's pads stay separate (docs/adr/0007).
   */
  joins(f: F): AnchorId[][];
}

const own = <F extends Feature>(anchors: (f: F) => AnchorInfo[]): AnchorKind<F> => ({
  anchors,
  joins: (f) => [anchors(f).map((a) => a.id)],
});

const none: AnchorKind<Feature> = { anchors: () => [], joins: () => [] };

const anchorKinds: { readonly [K in Feature['kind']]: AnchorKind<Extract<Feature, { kind: K }>> } =
  {
    trace: own((f) => f.vertices.map((v) => vertexInfo(f.id, f.layerId, v))),
    via: own((f) => point(f, null, f.at)),
    hole: own((f) => (f.plated ? point(f, null, f.at) : [])),
    pad: own((f) => point(f, f.layerId, f.at)),
    point: own((f) => point(f, f.layerId, f.at)),
    component: { anchors: componentPads, joins: () => [] },
    plane: { anchors: () => [], joins: (f) => [[...f.attached]] },
    text: none,
    silkLine: none,
    silkText: none,
  };

const anchorKind = (f: Feature) => anchorKinds[f.kind] as AnchorKind<Feature>;

/** The anchors a feature offers, in a stable order. */
export const anchorsOf = (f: Feature): AnchorInfo[] => anchorKind(f).anchors(f);

/** Groups of anchors the feature connects to each other. */
export const joinsOf = (f: Feature): AnchorId[][] => anchorKind(f).joins(f);

/** All anchors of a project by id, in feature order. Cached per (immutable) project. */
const indexes = new WeakMap<Project, ReadonlyMap<AnchorId, AnchorInfo>>();

export function anchorIndex(project: Project): ReadonlyMap<AnchorId, AnchorInfo> {
  const cached = indexes.get(project);
  if (cached !== undefined) {
    return cached;
  }
  const index = new Map(project.features.flatMap(anchorsOf).map((a) => [a.id, a] as const));
  indexes.set(project, index);
  return index;
}

/** Follows bindings to the anchor that has its own position (null if missing or cyclic). */
export function rootAnchor(project: Project, id: AnchorId): AnchorInfo | null {
  const index = anchorIndex(project);
  let current = index.get(id);
  for (let hops = 0; current !== undefined && hops <= index.size; hops++) {
    if (current.boundTo === null) {
      return current;
    }
    current = index.get(current.boundTo);
  }
  return null;
}

/** Board position of an anchor; a bound vertex sits on its root anchor. */
export const anchorPosition = (project: Project, id: AnchorId): Vec2 | null =>
  rootAnchor(project, id)?.at ?? null;

/** Whether an anchor can be reached from `layerId` (on that layer, or on every layer). */
export const anchorOnLayer = (anchor: AnchorInfo, layerId: LayerId): boolean =>
  anchor.layerId === null || anchor.layerId === layerId;
