import { rectFromSize, transformRect, unionRects, type Rect } from '../geometry/rect';
import type { LayerId, Project } from '../model/project';
import { layerTransform } from './alignment';

/** Board-space bounds of a layer's photo, or `null` when it has none. */
export function layerBounds(project: Project, layerId: LayerId): Rect | null {
  const image = project.layers.find((l) => l.id === layerId)?.image ?? null;
  const transform = layerTransform(project, layerId);
  if (image === null || transform === null) {
    return null;
  }
  return transformRect(transform, rectFromSize(image.widthPx, image.heightPx));
}

/** Bounds of the board outline and all photos, or `null` when there is nothing to show. */
export function projectBounds(project: Project): Rect | null {
  const photos = project.layers.map((l) => layerBounds(project, l.id));
  const board =
    project.board === null ? null : rectFromSize(project.board.widthMm, project.board.heightMm);
  return unionRects([...photos, board].filter((r): r is Rect => r !== null));
}
