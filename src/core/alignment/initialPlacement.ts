import { compose, scaling, translation, type Mat3 } from '../geometry/mat3';
import { rectFromSize, transformRect, unionRects, type Rect } from '../geometry/rect';
import type { Layer, Project, SourceImage } from '../model/project';

/**
 * Width in mm given to every photo before it is aligned. Photos of the same board taken at a
 * similar framing then roughly overlap. Replaced by real alignment in M2 (docs/adr/0002).
 */
export const NOMINAL_IMAGE_WIDTH_MM = 100;

/** Image pixels → board mm for a photo that has not been aligned yet. */
export function imageToBoard(image: SourceImage, mirrored: boolean): Mat3 {
  const mmPerPx = NOMINAL_IMAGE_WIDTH_MM / image.widthPx;
  const toMm = scaling(mmPerPx, mmPerPx);
  if (!mirrored) {
    return toMm;
  }
  const mirrorInPlace = compose(scaling(-1, 1), translation(image.widthPx, 0));
  return compose(mirrorInPlace, toMm);
}

/** Board-space bounds of a layer's photo, or `null` when it has none. */
export function layerBounds(layer: Layer): Rect | null {
  if (layer.image === null) {
    return null;
  }
  const pixels = rectFromSize(layer.image.widthPx, layer.image.heightPx);
  return transformRect(imageToBoard(layer.image, layer.mirrored), pixels);
}

/** Board-space bounds of all photos in the project, or `null` when there are none. */
export function projectBounds(project: Project): Rect | null {
  const bounds = project.layers.map(layerBounds).filter((b): b is Rect => b !== null);
  return unionRects(bounds);
}
