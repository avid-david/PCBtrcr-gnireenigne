import { imageToBoard, solveAlignment } from '../core/alignment/alignment';
import type { Vec2 } from '../core/geometry/vec2';
import { pointsOnLayer, samePoint, type PointRef } from '../core/model/points';
import { cornerPosition, type LayerId, type Project } from '../core/model/project';
import type { AlignState } from '../tools/align';
import { pointLabel } from '../tools/alignHint';

/**
 * How a marker relates to the fit: used for it, flagged as an outlier, not used (e.g. a match
 * side on the reference layer), or the first click of an unfinished match.
 */
export type MarkerStatus = 'fitted' | 'outlier' | 'unused' | 'pending';

/** An alignment point drawn over the board, in board mm. */
export interface SceneMarker {
  readonly at: Vec2;
  readonly label: string;
  readonly status: MarkerStatus;
}

function statusOf(project: Project, layerId: LayerId, ref: PointRef): MarkerStatus {
  const fit = solveAlignment(project)
    .get(layerId)
    ?.fits.find((f) => samePoint(f.ref, ref));
  if (fit === undefined) {
    return 'unused';
  }
  return fit.outlier ? 'outlier' : 'fitted';
}

/** Markers for the points clicked on the active layer, plus a pending match click. */
export function alignMarkers(
  project: Project,
  align: AlignState,
  activeLayerId: LayerId,
): SceneMarker[] {
  const markers = pointsOnLayer(project, activeLayerId).flatMap(({ ref, px }): SceneMarker[] => {
    const at = imageToBoard(project, activeLayerId, px);
    return at === null
      ? []
      : [{ at, label: pointLabel(project, ref), status: statusOf(project, activeLayerId, ref) }];
  });
  const pending = align.pending;
  const pendingAt = pending === null ? null : imageToBoard(project, pending.layerId, pending.px);
  return pendingAt === null || pending?.layerId !== activeLayerId
    ? markers
    : [...markers, { at: pendingAt, label: '?', status: 'pending' }];
}

/** The board outline as a closed polygon in board mm, or `null` without a board size. */
export function boardOutline(project: Project): Vec2[] | null {
  const board = project.board;
  return board === null
    ? null
    : (['tl', 'tr', 'br', 'bl'] as const).map((c) => cornerPosition(board, c));
}
