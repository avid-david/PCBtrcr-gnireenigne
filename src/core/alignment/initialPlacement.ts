import { compose, scaling, translation, type Mat3 } from '../geometry/mat3';
import type { Board, SourceImage } from '../model/project';

/**
 * Width in mm given to a photo that is not aligned yet and has no board size to go by. Photos
 * of the same board taken at a similar framing then roughly overlap (docs/adr/0002).
 */
export const NOMINAL_IMAGE_WIDTH_MM = 100;

export interface PlacementOptions {
  readonly mirrored: boolean;
  readonly board: Board | null;
}

/**
 * Image pixels → board mm for a photo that is not aligned yet: scaled to the board width (or the
 * nominal width) and optionally mirrored in place.
 */
export function unalignedTransform(image: SourceImage, options: PlacementOptions): Mat3 {
  const widthMm = options.board?.widthMm ?? NOMINAL_IMAGE_WIDTH_MM;
  const mmPerPx = widthMm / image.widthPx;
  const toMm = scaling(mmPerPx, mmPerPx);
  if (!options.mirrored) {
    return toMm;
  }
  const mirrorInPlace = compose(scaling(-1, 1), translation(image.widthPx, 0));
  return compose(mirrorInPlace, toMm);
}
