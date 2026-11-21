import { anchorsOf } from '../model/anchors';
import type { AnchorId, Feature, FeatureId } from '../model/features';
import type { Project } from '../model/project';
import { UnionFind } from './unionFind';

/** A net is named by its oldest anchor (first in drawing order), which keeps it stable. */
export type NetId = AnchorId;

export interface Net {
  readonly id: NetId;
  /** 1-based position among all nets, in order of their oldest anchor (for display). */
  readonly number: number;
  readonly anchors: readonly AnchorId[];
}

/** Connectivity of a project. Derived on demand and cached per project; never stored. */
export interface Nets {
  readonly nets: readonly Net[];
  netOfAnchor(id: AnchorId): Net | undefined;
  /** Net of a feature's copper; `undefined` for features that cannot connect. */
  netOfFeature(id: FeatureId): Net | undefined;
}

/** Ties every anchor of one feature together (a trace is one conductor) and to its bindings. */
function connect(sets: UnionFind, feature: Feature): void {
  const anchors = anchorsOf(feature);
  const first = anchors[0];
  for (const anchor of anchors) {
    sets.add(anchor.id);
    if (first !== undefined) {
      sets.union(first.id, anchor.id);
    }
    if (anchor.boundTo !== null) {
      sets.union(anchor.id, anchor.boundTo);
    }
  }
}

function groupByRoot(sets: UnionFind, order: readonly AnchorId[]): AnchorId[][] {
  const groups = new Map<string, AnchorId[]>();
  for (const id of order) {
    const root = sets.find(id);
    const group = groups.get(root);
    if (group === undefined) {
      groups.set(root, [id]);
    } else {
      group.push(id);
    }
  }
  return [...groups.values()];
}

const cache = new WeakMap<Project, Nets>();

/**
 * Nets by union-find over explicit connections (SPEC "Connectivity"): a trace joins its own
 * vertices, and a bound vertex joins its anchor. Vias, plated holes and through-hole pads are
 * single anchors on every layer, so they join top and bottom nets.
 */
export function deriveNets(project: Project): Nets {
  const cached = cache.get(project);
  if (cached !== undefined) {
    return cached;
  }
  const sets = new UnionFind();
  project.features.forEach((f) => {
    connect(sets, f);
  });
  const order = project.features.flatMap((f) => anchorsOf(f).map((a) => a.id));
  const nets = groupByRoot(sets, order).map((anchors, i) => ({
    id: anchors[0] ?? '',
    number: i + 1,
    anchors,
  }));
  const byAnchor = new Map(nets.flatMap((net) => net.anchors.map((a) => [a, net] as const)));
  const byFeature = new Map(
    project.features.flatMap((f) => {
      const net = byAnchor.get(anchorsOf(f)[0]?.id ?? '');
      return net === undefined ? [] : [[f.id, net] as const];
    }),
  );
  const result: Nets = {
    nets,
    netOfAnchor: (id) => byAnchor.get(id),
    netOfFeature: (id) => byFeature.get(id),
  };
  cache.set(project, result);
  return result;
}
