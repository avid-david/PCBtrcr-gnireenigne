import { anchorsOf, joinsOf } from '../model/anchors';
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
  /** Net of a feature's copper; `undefined` for features without one net (components, text…). */
  netOfFeature(id: FeatureId): Net | undefined;
}

/** Joins what the feature connects (e.g. a trace's vertices) and each bound anchor to its target. */
function connect(sets: UnionFind, feature: Feature): void {
  for (const anchor of anchorsOf(feature)) {
    sets.add(anchor.id);
    if (anchor.boundTo !== null) {
      sets.union(anchor.id, anchor.boundTo);
    }
  }
  for (const [first, ...rest] of joinsOf(feature)) {
    rest.forEach((id) => {
      sets.union(first ?? id, id);
    });
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
 * vertices, a plane joins its attached anchors, and a bound vertex joins its anchor. A component's
 * pads are separate anchors. Vias, plated holes and through-hole pads are
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
      // A feature has one net when it joins its anchors (not a component, whose pads differ).
      const net = byAnchor.get(joinsOf(f)[0]?.[0] ?? '');
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
