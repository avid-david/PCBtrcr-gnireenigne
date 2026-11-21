import type { Project } from '../core/model/project';
import type { EditorStore } from '../ui/store';
import type { ImageRegistry } from './imageRegistry';

/** Ids of all photos the project references. */
export const imageIdsInUse = (project: Project): Set<string> =>
  new Set(project.layers.flatMap((l) => (l.image === null ? [] : [l.image.id])));

/**
 * Frees decoded photos as soon as the project stops referencing them (a photo was replaced or
 * a new project started). Returns the unsubscribe function.
 */
export function syncImagesWithProject<P>(store: EditorStore, images: ImageRegistry<P>): () => void {
  return store.subscribe((state, previous) => {
    if (state.project !== previous.project) {
      images.retainOnly(imageIdsInUse(state.project));
    }
  });
}
