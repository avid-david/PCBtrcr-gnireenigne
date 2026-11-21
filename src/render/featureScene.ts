import { netColor } from '../core/connectivity/netColors';
import { deriveNets } from '../core/connectivity/nets';
import type { Vec2 } from '../core/geometry/vec2';
import { featureOnLayer, tracePoints } from '../core/model/featureKinds';
import type { Feature, FeatureId } from '../core/model/features';
import type { LayerId, Project } from '../core/model/project';

/** Colour of copper that cannot connect (mechanical holes). */
export const NO_NET_COLOR = 0x9aa0a6;

/** A feature ready to draw: resolved trace points, its net colour and how to show it. */
export interface FeatureDrawable {
  readonly feature: Feature;
  /** Trace vertex positions (bound vertices resolved); empty for other kinds. */
  readonly points: readonly Vec2[];
  readonly color: number;
  /** Only on an inactive layer: drawn faintly and not editable (SPEC "Layers and overlay"). */
  readonly dimmed: boolean;
}

function drawable(project: Project, f: Feature, activeLayerId: LayerId): FeatureDrawable {
  const net = deriveNets(project).netOfFeature(f.id);
  return {
    feature: f,
    points: f.kind === 'trace' ? tracePoints(f, project) : [],
    color: net === undefined ? NO_NET_COLOR : netColor(net.id),
    dimmed: !featureOnLayer(f, activeLayerId),
  };
}

let last: { project: Project; activeLayerId: LayerId; result: readonly FeatureDrawable[] } | null =
  null;

/**
 * Features in drawing order: inactive-layer features first (under), then the active layer's
 * and all-layer features. The same array is returned while project and layer are unchanged,
 * so the renderer rebuilds its geometry only after edits, not on every pan or zoom frame.
 */
export function featureDrawables(
  project: Project,
  activeLayerId: LayerId,
): readonly FeatureDrawable[] {
  if (last?.project === project && last.activeLayerId === activeLayerId) {
    return last.result;
  }
  const all = project.features.map((f) => drawable(project, f, activeLayerId));
  const result = [...all.filter((d) => d.dimmed), ...all.filter((d) => !d.dimmed)];
  last = { project, activeLayerId, result };
  return result;
}

/** The features listed by id, for the selection highlight. */
export const selectedFeatures = (project: Project, selection: readonly FeatureId[]): Feature[] =>
  project.features.filter((f) => selection.includes(f.id));
