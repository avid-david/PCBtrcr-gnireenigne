import { setLayerImage } from '../core/commands/command';
import { describeImageLoadError } from '../core/model/image';
import type { LayerId } from '../core/model/project';
import { fitToView } from '../core/view/viewState';
import type { ImageFile, ImageLoader } from '../platform/imageLoader';
import type { EditorStore } from '../ui/store';
import type { ImageRegistry } from './imageRegistry';
import { imageIdsInUse } from './imageSync';

export interface ImportDeps<F extends ImageFile, P> {
  readonly store: EditorStore;
  readonly images: ImageRegistry<P>;
  readonly load: ImageLoader<F, P>;
}

/**
 * Loads a photo onto a layer. Errors become a status-bar notice. The first photo of a project
 * is fitted to the view so the user sees it immediately. A photo that finishes loading after a
 * new project was started belongs to the discarded project, so it is freed and ignored.
 */
export function createPhotoImporter<F extends ImageFile, P>({
  store,
  images,
  load,
}: ImportDeps<F, P>) {
  return async (layerId: LayerId, file: F): Promise<void> => {
    const generation = store.getState().projectGeneration;
    const result = await load(file);
    if (store.getState().projectGeneration !== generation) {
      if (result.ok) {
        images.discard(result.value);
      }
      return;
    }
    if (!result.ok) {
      store.getState().setNotice(describeImageLoadError(result.error));
      return;
    }
    const isFirstPhoto = imageIdsInUse(store.getState().project).size === 0;
    images.add(result.value);
    store.getState().dispatch(setLayerImage(layerId, result.value.image));
    store.getState().setNotice(`Imported ${file.name}`);
    if (isFirstPhoto) {
      store.getState().updateView(fitToView);
    }
  };
}
