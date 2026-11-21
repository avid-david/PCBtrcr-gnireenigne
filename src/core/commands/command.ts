import type { Vec2 } from '../geometry/vec2';
import { movePoint, removePoint, type PointRef } from '../model/points';
import {
  updateLayer,
  type Board,
  type LayerId,
  type PointMatch,
  type Project,
  type SourceImage,
} from '../model/project';

/**
 * An edit of the project. Every model mutation goes through a command so that undo/redo (M3)
 * can be added without touching callers. Commands are pure: they return a new project.
 */
export interface Command {
  readonly label: string;
  execute(project: Project): Project;
}

/**
 * Sets (or replaces) the photo of a layer. Points clicked on the previous photo refer to its
 * pixels, so the layer's corners and its sides of all matches are dropped.
 */
export const setLayerImage = (layerId: LayerId, image: SourceImage): Command => ({
  label: `Import ${image.fileName}`,
  execute: (project) => ({
    ...updateLayer(project, layerId, (layer) => ({ ...layer, image, corners: {} })),
    matches: project.matches.filter((m) => !(layerId in m.points)),
  }),
});

/** Mirrors or un-mirrors a layer's unaligned photo horizontally. */
export const setLayerMirrored = (layerId: LayerId, mirrored: boolean): Command => ({
  label: mirrored ? 'Mirror photo' : 'Unmirror photo',
  execute: (project) => updateLayer(project, layerId, (layer) => ({ ...layer, mirrored })),
});

/** Sets the outer board size in mm. */
export const setBoardSize = (board: Board): Command => ({
  label: `Set board size ${String(board.widthMm)} × ${String(board.heightMm)} mm`,
  execute: (project) => ({ ...project, board }),
});

/** Places (or moves) an alignment point at an image-pixel position. */
export const placePoint = (ref: PointRef, px: Vec2): Command => ({
  label: ref.kind === 'corner' ? 'Place corner' : 'Move matched point',
  execute: (project) => movePoint(project, ref, px),
});

/** Deletes an alignment point (a whole match for match points). */
export const deletePoint = (ref: PointRef): Command => ({
  label: ref.kind === 'corner' ? 'Delete corner' : 'Delete matched point',
  execute: (project) => removePoint(project, ref),
});

/** Adds a feature matched across layers. */
export const addMatch = (match: PointMatch): Command => ({
  label: 'Add matched point',
  execute: (project) => ({ ...project, matches: [...project.matches, match] }),
});
