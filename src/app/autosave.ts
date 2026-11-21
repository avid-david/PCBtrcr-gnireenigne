import { z } from 'zod';
import { describeLoadError, parseProject, serializeProject } from '../core/io/projectFile';
import type { KeyValueStore } from '../platform/keyValueStore';
import type { ImageFile } from '../platform/imageLoader';
import { isDirty, type EditorState, type EditorStore } from '../ui/store';
import type { ImageRegistry } from './imageRegistry';
import { installProject, photosOf, type ProjectFileDeps } from './projectFiles';

// One autosave slot (docs/adr/0006): the project under AUTOSAVE_KEY and each original photo
// under its own key, written once, so a change to the project does not rewrite the photos.
export const AUTOSAVE_KEY = 'autosave';
export const AUTOSAVE_DELAY_MS = 1000;
const IMAGE_PREFIX = 'image:';
const imageKey = (id: string) => `${IMAGE_PREFIX}${id}`;

const recordSchema = z.object({
  json: z.string(),
  fileName: z.string(),
  /** Whether the work differs from the last file saved; only then is recovery offered. */
  dirty: z.boolean(),
  savedAt: z.number(),
});
export type AutosaveRecord = z.infer<typeof recordSchema>;

// Checked by tag, not instanceof: stored values may come from another realm.
const bytesSchema = z.custom<Uint8Array>(
  (v) => Object.prototype.toString.call(v) === '[object Uint8Array]',
);
const photoSchema = z.object({ mimeType: z.string(), bytes: bytesSchema });

export interface AutosaveDeps<P> {
  readonly store: EditorStore;
  readonly images: ImageRegistry<P>;
  readonly storage: KeyValueStore;
  /** Runs `run` after `delayMs`; returns a function that cancels it. Injectable for tests. */
  readonly schedule: (run: () => void, delayMs: number) => () => void;
  readonly now: () => number;
}

export interface Autosave {
  /** Writes a pending change now (e.g. when the page is hidden). */
  flush(): Promise<void>;
  stop(): void;
}

async function writeSnapshot<P>(deps: AutosaveDeps<P>, written: Set<string>): Promise<void> {
  const state = deps.store.getState();
  const photos = photosOf(state.project, deps.images);
  for (const photo of photos.filter((p) => !written.has(p.imageId))) {
    await deps.storage.set(imageKey(photo.imageId), {
      mimeType: photo.mimeType,
      bytes: photo.bytes,
    });
    written.add(photo.imageId);
  }
  const record: AutosaveRecord = {
    json: serializeProject(state.project),
    fileName: state.fileName,
    dirty: isDirty(state),
    savedAt: deps.now(),
  };
  await deps.storage.set(AUTOSAVE_KEY, record);
  const keep = new Set(photos.map((p) => imageKey(p.imageId)));
  const stale = (await deps.storage.keys()).filter(
    (k) => k.startsWith(IMAGE_PREFIX) && !keep.has(k),
  );
  for (const key of stale) {
    await deps.storage.delete(key);
    written.delete(key.slice(IMAGE_PREFIX.length));
  }
}

const reasonOf = (cause: unknown) => (cause instanceof Error ? cause.message : String(cause));

const changed = (s: EditorState, p: EditorState) =>
  s.project !== p.project ||
  s.savedProject !== p.savedProject ||
  s.fileName !== p.fileName ||
  s.recovery !== p.recovery;

/**
 * Writes the project to storage a moment after every change. Paused while unsaved work from
 * an earlier session waits to be restored or discarded, so it is not overwritten.
 */
export function startAutosave<P>(deps: AutosaveDeps<P>): Autosave {
  const written = new Set<string>();
  let queue = Promise.resolve();
  let cancel: (() => void) | null = null;
  const write = () => {
    cancel = null;
    queue = queue
      .then(() => writeSnapshot(deps, written))
      .catch((cause: unknown) => {
        deps.store.getState().setNotice(`Autosave failed: ${reasonOf(cause)}`);
      });
    return queue;
  };
  const unsubscribe = deps.store.subscribe((state, previous) => {
    if (state.recovery === null && changed(state, previous)) {
      cancel?.();
      // Record a save to a file at once, so closing the tab right after does not offer recovery.
      const delay = state.savedProject !== previous.savedProject ? 0 : AUTOSAVE_DELAY_MS;
      cancel = deps.schedule(() => void write(), delay);
    }
  });
  return {
    flush: () => {
      if (cancel === null) {
        return queue;
      }
      cancel();
      return write();
    },
    stop: () => {
      cancel?.();
      unsubscribe();
    },
  };
}

/** The autosave left by an earlier session, if it holds work that was never saved to a file. */
export async function readRecovery(storage: KeyValueStore): Promise<AutosaveRecord | null> {
  const record = recordSchema.safeParse(await storage.get(AUTOSAVE_KEY));
  return record.success && record.data.dirty ? record.data : null;
}

/** Removes the autosave and its photos. */
export async function clearAutosave(storage: KeyValueStore): Promise<void> {
  await Promise.all([AUTOSAVE_KEY, ...(await storage.keys())].map((k) => storage.delete(k)));
}

async function storedPhoto(storage: KeyValueStore, id: string) {
  const photo = photoSchema.safeParse(await storage.get(imageKey(id)));
  return photo.success ? [[id, photo.data.bytes] as const] : [];
}

/** Restores autosaved work into the editor. It stays marked unsaved until saved to a file. */
export async function restoreAutosave<F extends ImageFile, P>(
  deps: ProjectFileDeps<F, P> & { readonly storage: KeyValueStore },
  record: AutosaveRecord,
): Promise<void> {
  const project = parseProject(record.json);
  if (!project.ok) {
    deps.store.getState().setNotice(`Could not restore: ${describeLoadError(project.error)}`);
    return;
  }
  const ids = project.value.layers.flatMap((l) => (l.image === null ? [] : [l.image.id]));
  const photos = new Map(
    (await Promise.all(ids.map((id) => storedPhoto(deps.storage, id)))).flat(),
  );
  const stored = { project: project.value, photos, fileName: record.fileName, saved: false };
  await installProject(deps, stored, 'Restored unsaved work.');
}
