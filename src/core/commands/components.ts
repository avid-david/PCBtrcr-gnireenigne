import { rotateComponent } from '../model/component';
import { anchorIndex, anchorOnLayer, anchorPosition } from '../model/anchors';
import type { AnchorId, Component, Feature, FeatureId, Plane } from '../model/features';
import type { LayerId, Project } from '../model/project';
import { pointInPolygon } from '../geometry/polygon';
import type { Command } from './command';

const mapFeatures = (project: Project, fn: (f: Feature) => Feature): Project => ({
  ...project,
  features: project.features.map(fn),
});

const isComponentIn =
  (ids: ReadonlySet<FeatureId>) =>
  (f: Feature): f is Component =>
    f.kind === 'component' && ids.has(f.id);

/** Turns components clockwise by `deg` about their origins; tied traces follow their pads. */
export const rotateComponents = (ids: readonly FeatureId[], deg: number): Command => ({
  label: ids.length === 1 ? 'Rotate component' : `Rotate ${String(ids.length)} components`,
  execute: (project) => {
    const rotating = isComponentIn(new Set(ids));
    return project.features.some(rotating)
      ? mapFeatures(project, (f) => (rotating(f) ? rotateComponent(f, deg) : f))
      : project;
  },
});

/** The layer on the other side of the board from `layerId`, if there is one. */
export function oppositeLayer(project: Project, layerId: LayerId): LayerId | null {
  const side = project.layers.find((l) => l.id === layerId)?.side;
  return project.layers.find((l) => l.side !== side)?.id ?? null;
}

/**
 * Trace vertices and plane attachments that tie into `pads` from another layer than `layerId`
 * are released; trace vertices stay where they were.
 */
function releaseCrossLayerTies(project: Project, pads: ReadonlySet<AnchorId>, layerId: LayerId) {
  return mapFeatures(project, (f) => {
    if (f.kind === 'trace' && f.layerId !== layerId) {
      const vertices = f.vertices.map((v) => {
        const at =
          v.kind === 'bound' && pads.has(v.anchor) ? anchorPosition(project, v.anchor) : null;
        return at === null ? v : { id: v.id, kind: 'free' as const, at };
      });
      return { ...f, vertices };
    }
    return f.kind === 'plane' && f.layerId !== layerId
      ? { ...f, attached: f.attached.filter((id) => !pads.has(id)) }
      : f;
  });
}

function flipOne(project: Project, id: FeatureId): Project {
  const component = project.features.find(isComponentIn(new Set([id])));
  const target = component === undefined ? null : oppositeLayer(project, component.layerId);
  if (component === undefined || target === null) {
    return project;
  }
  const flipped = { ...component, layerId: target, flipped: !component.flipped };
  const smdPads = new Set(component.pads.filter((p) => p.drillMm === 0).map((p) => p.id));
  const released = releaseCrossLayerTies(project, smdPads, target);
  return mapFeatures(released, (f) => (f.id === id ? flipped : f));
}

/**
 * Moves components to the other side of the board (mirrored, same place). Ties from the old
 * side to their surface-mount pads are released, since they would now cross layers.
 */
export const flipComponents = (ids: readonly FeatureId[]): Command => ({
  label: ids.length === 1 ? 'Flip component' : `Flip ${String(ids.length)} components`,
  execute: (project) => ids.reduce(flipOne, project),
});

const withPlane =
  (planeId: FeatureId, edit: (plane: Plane, project: Project) => Plane) =>
  (project: Project): Project =>
    mapFeatures(project, (f) => (f.kind === 'plane' && f.id === planeId ? edit(f, project) : f));

/** Anchors that can join a plane: on its layer (or every layer), and not trace vertices. */
function attachable(
  project: Project,
  plane: Plane,
): Map<AnchorId, { at: { x: number; y: number } }> {
  const traces = new Set(project.features.filter((f) => f.kind === 'trace').map((f) => f.id));
  const result = new Map<AnchorId, { at: { x: number; y: number } }>();
  for (const anchor of anchorIndex(project).values()) {
    if (
      anchor.at !== null &&
      !traces.has(anchor.featureId) &&
      anchorOnLayer(anchor, plane.layerId)
    ) {
      result.set(anchor.id, { at: anchor.at });
    }
  }
  return result;
}

const merge = (plane: Plane, ids: readonly AnchorId[]): Plane => ({
  ...plane,
  attached: [...new Set([...plane.attached, ...ids])],
});

/** Attaches anchors to a plane's net; anchors it cannot reach (other layer) are ignored. */
/** The anchors among `ids` that attaching would add to the plane (reachable, not yet attached). */
export function newAttachments(
  project: Project,
  plane: Plane,
  ids: readonly AnchorId[],
): AnchorId[] {
  const allowed = attachable(project, plane);
  return [...new Set(ids)].filter((id) => allowed.has(id) && !plane.attached.includes(id));
}

export const attachToPlane = (planeId: FeatureId, ids: readonly AnchorId[]): Command => ({
  label: 'Attach to plane',
  execute: withPlane(planeId, (plane, project) =>
    merge(plane, newAttachments(project, plane, ids)),
  ),
});

/** Attaches every pad, via, plated hole and point inside the plane's outline (one explicit step). */
export const attachInsideToPlane = (planeId: FeatureId): Command => ({
  label: 'Attach anchors inside plane',
  execute: withPlane(planeId, (plane, project) => {
    const inside = [...attachable(project, plane)].filter(([, a]) =>
      pointInPolygon(a.at, plane.outline),
    );
    return merge(
      plane,
      inside.map(([id]) => id),
    );
  }),
});

/** Removes every attachment of a plane. */
export const detachAllFromPlane = (planeId: FeatureId): Command => ({
  label: 'Detach from plane',
  execute: withPlane(planeId, (plane) => ({ ...plane, attached: [] })),
});
