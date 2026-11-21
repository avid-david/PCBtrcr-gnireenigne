import { projectsInHistory, type History } from '../core/commands/history';
import type { Project } from '../core/model/project';
import type { EditorStore } from '../ui/store';
import type { ImageRegistry } from './imageRegistry';

/** Ids of all photos the project references. */
export const imageIdsInUse = (project: Project): Set<string> =>
  new Set(project.layers.flatMap((l) => (l.image === null ? [] : [l.image.id])));

/** Ids of photos the project or any undo/redo step references (decision in docs/adr/0005). */
export const imageIdsReachable = (project: Project, history: History): Set<string> =>
  new Set([project, ...projectsInHistory(history)].flatMap((p) => [...imageIdsInUse(p)]));

/**
 * Frees decoded photos once neither the project nor its undo history references them (a photo
 * replaced and the step forgotten, or a new project started). Returns the unsubscribe function.
 */
export function syncImagesWithProject<P>(store: EditorStore, images: ImageRegistry<P>): () => void {
  return store.subscribe((state, previous) => {
    if (state.project !== previous.project || state.history !== previous.history) {
      images.retainOnly(imageIdsReachable(state.project, state.history));
    }
  });
}
