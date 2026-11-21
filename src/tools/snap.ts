import { distance } from '../core/geometry/distance';
import type { Vec2 } from '../core/geometry/vec2';
import { anchorIndex, anchorOnLayer, rootAnchor, type AnchorInfo } from '../core/model/anchors';
import type { AnchorId } from '../core/model/features';
import type { LayerId, Project } from '../core/model/project';
import type { ToolSettings } from './settings';

/** Where a click lands after snapping, and the anchor it lands on (if any). */
export interface Snap {
  readonly at: Vec2;
  readonly anchor: AnchorId | null;
}

export interface SnapOptions {
  readonly project: Project;
  readonly layerId: LayerId;
  readonly radiusMm: number;
  readonly grid: ToolSettings['grid'];
}

/** Rounds to the grid when grid snapping is on. */
export function snapToGrid(p: Vec2, grid: ToolSettings['grid']): Vec2 {
  if (!grid.enabled || grid.stepMm <= 0) {
    return p;
  }
  const round = (v: number) => Math.round(v / grid.stepMm) * grid.stepMm;
  return { x: round(p.x), y: round(p.y) };
}

/** Where clicking on this anchor would land (bound vertices → their root), if reachable. */
function candidate(anchor: AnchorInfo, options: SnapOptions): Snap | null {
  const root = rootAnchor(options.project, anchor.id);
  const at = root?.at ?? null;
  return root === null || at === null || !anchorOnLayer(anchor, options.layerId)
    ? null
    : { at, anchor: root.id };
}

/** The nearest reachable anchor within the radius. */
function nearestAnchor(p: Vec2, options: SnapOptions): Snap | null {
  let best: Snap | null = null;
  let bestDistance = options.radiusMm;
  for (const anchor of anchorIndex(options.project).values()) {
    const snap = candidate(anchor, options);
    const d = snap === null ? Number.POSITIVE_INFINITY : distance(p, snap.at);
    if (d <= bestDistance) {
      best = snap;
      bestDistance = d;
    }
  }
  return best;
}

/**
 * Snapping (SPEC F3): to anchors first (pads, vias, holes, points, trace vertices within the
 * radius on this layer or all layers), otherwise to the grid if it is on.
 */
export const snapPoint = (p: Vec2, options: SnapOptions): Snap =>
  nearestAnchor(p, options) ?? { at: snapToGrid(p, options.grid), anchor: null };
