import type { Vec2 } from '../geometry/vec2';
import { anchorPosition, anchorsOf } from '../model/anchors';
import { translateFeature } from '../model/featureKinds';
import type { AnchorId, Feature, FeatureId, TraceVertex } from '../model/features';
import type { Project } from '../model/project';
import type { Command } from './command';

const replaceFeatures = (project: Project, features: readonly Feature[]): Project => ({
  ...project,
  features,
});

/** Whether any of the ids names a feature of the project (commands on none are no-ops). */
const touchesAny = (project: Project, ids: ReadonlySet<FeatureId>): boolean =>
  project.features.some((f) => ids.has(f.id));

/** Adds a feature on top of the others. */
export const addFeature = (feature: Feature): Command => ({
  label: `Add ${feature.kind}`,
  execute: (project) => replaceFeatures(project, [...project.features, feature]),
});

/** Replaces a feature by id (e.g. an edited property); unknown ids change nothing. */
export const updateFeature = (feature: Feature): Command => ({
  label: `Edit ${feature.kind}`,
  execute: (project) =>
    replaceFeatures(
      project,
      project.features.map((f) => (f.id === feature.id ? feature : f)),
    ),
});

/** A bound vertex whose anchor disappears is freed where it was, so traces stay intact. */
function unbind(project: Project, removed: ReadonlySet<AnchorId>, v: TraceVertex): TraceVertex {
  if (v.kind === 'free' || !removed.has(v.anchor)) {
    return v;
  }
  const at = anchorPosition(project, v.anchor);
  return at === null ? v : { id: v.id, kind: 'free', at };
}

/** Deletes features; trace vertices tied to their anchors are freed in place. */
export const removeFeatures = (ids: readonly FeatureId[]): Command => ({
  label: ids.length === 1 ? 'Delete feature' : `Delete ${String(ids.length)} features`,
  execute: (project) => {
    const gone = new Set(ids);
    if (!touchesAny(project, gone)) {
      return project;
    }
    const removedAnchors = new Set(
      project.features.filter((f) => gone.has(f.id)).flatMap((f) => anchorsOf(f).map((a) => a.id)),
    );
    const kept = project.features
      .filter((f) => !gone.has(f.id))
      .map((f) =>
        f.kind === 'trace'
          ? { ...f, vertices: f.vertices.map((v) => unbind(project, removedAnchors, v)) }
          : f,
      );
    return replaceFeatures(project, kept);
  },
});

/** Moves features; trace vertices bound to moved anchors follow automatically. */
export const moveFeatures = (ids: readonly FeatureId[], delta: Vec2): Command => ({
  label: ids.length === 1 ? 'Move feature' : `Move ${String(ids.length)} features`,
  execute: (project) => {
    const moving = new Set(ids);
    if (!touchesAny(project, moving) || (delta.x === 0 && delta.y === 0)) {
      return project;
    }
    return replaceFeatures(
      project,
      project.features.map((f) => (moving.has(f.id) ? translateFeature(f, delta) : f)),
    );
  },
});
