import type { LoadedImage } from '../core/model/image';
import type { ImageId } from '../core/model/project';

/** Decoded photos by image id, kept outside the (serializable) model. */
export interface ImageRegistry<P> {
  get(id: ImageId): LoadedImage<P> | undefined;
  add(image: LoadedImage<P>): void;
  /** Frees the pixels of an image and tells listeners it is gone. */
  remove(id: ImageId): void;
  /** Removes every image not in `keep`. */
  retainOnly(keep: ReadonlySet<ImageId>): void;
  onRemove(listener: (id: ImageId) => void): () => void;
}

/** Creates a registry; `release` frees one tile's pixels (e.g. `ImageBitmap.close`). */
export function createImageRegistry<P>(release: (pixels: P) => void): ImageRegistry<P> {
  const images = new Map<ImageId, LoadedImage<P>>();
  const listeners = new Set<(id: ImageId) => void>();
  const remove = (id: ImageId) => {
    const image = images.get(id);
    if (image === undefined) {
      return;
    }
    images.delete(id);
    listeners.forEach((listener) => {
      listener(id);
    });
    image.tiles.forEach((tile) => {
      release(tile.pixels);
    });
  };
  return {
    get: (id) => images.get(id),
    add: (image) => images.set(image.image.id, image),
    remove,
    retainOnly: (keep) => {
      [...images.keys()].filter((id) => !keep.has(id)).forEach(remove);
    },
    onRemove: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
