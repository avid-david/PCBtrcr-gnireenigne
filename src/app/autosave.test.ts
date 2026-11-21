import { describe, expect, it, vi } from 'vitest';
import { setLayerImage } from '../core/commands/command';
import { addFeature } from '../core/commands/features';
import { serializeProject } from '../core/io/projectFile';
import { via } from '../core/model/features.test-support';
import { createProject } from '../core/model/project';
import { createMemoryStore } from '../platform/keyValueStore.test-support';
import { isDirty } from '../ui/store';
import {
  AUTOSAVE_DELAY_MS,
  AUTOSAVE_KEY,
  clearAutosave,
  readRecovery,
  restoreAutosave,
  startAutosave,
  type AutosaveRecord,
} from './autosave';
import { fakeDeps, loadedPhoto, photoBytes, sourceImage } from './fakePhotos.test-support';

/** A scheduler the test runs by hand. */
function manualScheduler() {
  const queue: { run: () => void; delayMs: number; cancelled: boolean }[] = [];
  return {
    queue,
    schedule: (run: () => void, delayMs: number) => {
      const job = { run, delayMs, cancelled: false };
      queue.push(job);
      return () => {
        job.cancelled = true;
      };
    },
    /** Runs the jobs still due and waits for their writes. */
    runAll: async (flush: () => Promise<void>) => {
      queue
        .filter((j) => !j.cancelled)
        .forEach((j) => {
          j.cancelled = true;
          j.run();
        });
      await flush();
    },
  };
}

function setup() {
  const deps = fakeDeps();
  const storage = createMemoryStore();
  const scheduler = manualScheduler();
  const autosave = startAutosave({ ...deps, storage, schedule: scheduler.schedule, now: () => 42 });
  const run = () => scheduler.runAll(() => autosave.flush());
  return { ...deps, storage, scheduler, autosave, run };
}

const addPhoto = (s: ReturnType<typeof setup>, id: string, layerId = 'top') => {
  s.images.add(loadedPhoto(id));
  s.store.getState().dispatch(setLayerImage(layerId, sourceImage(id)));
};

describe('autosave', () => {
  it('writes the project and its photos a moment after a change', async () => {
    const s = setup();
    addPhoto(s, 'img1');
    expect(s.scheduler.queue.map((j) => j.delayMs)).toEqual([AUTOSAVE_DELAY_MS]);
    await s.run();
    const record = s.storage.data.get(AUTOSAVE_KEY) as AutosaveRecord;
    expect(record).toEqual({
      json: serializeProject(s.store.getState().project),
      fileName: 'board',
      dirty: true,
      savedAt: 42,
    });
    expect(s.storage.data.get('image:img1')).toEqual({
      mimeType: 'image/png',
      bytes: photoBytes('10x10'),
    });
  });

  it('waits for a pause: each change restarts the delay', () => {
    const s = setup();
    s.store.getState().dispatch(addFeature(via('a', { x: 0, y: 0 })));
    s.store.getState().dispatch(addFeature(via('b', { x: 1, y: 0 })));
    expect(s.scheduler.queue.map((j) => j.cancelled)).toEqual([true, false]);
  });

  it('writes each photo once and removes photos the project no longer uses', async () => {
    const s = setup();
    const set = vi.spyOn(s.storage, 'set');
    addPhoto(s, 'img1');
    await s.run();
    s.store.getState().dispatch(addFeature(via('a', { x: 0, y: 0 })));
    await s.run();
    expect(set.mock.calls.filter(([key]) => key === 'image:img1')).toHaveLength(1);
    addPhoto(s, 'img2');
    await s.run();
    expect([...s.storage.data.keys()].sort()).toEqual([AUTOSAVE_KEY, 'image:img2']);
  });

  it('records a saved project as not dirty', async () => {
    const s = setup();
    s.store.getState().dispatch(addFeature(via('a', { x: 0, y: 0 })));
    s.store.getState().markSaved(s.store.getState().project, 'amp');
    expect(s.scheduler.queue.at(-1)?.delayMs).toBe(0);
    await s.run();
    expect(s.storage.data.get(AUTOSAVE_KEY)).toMatchObject({ dirty: false, fileName: 'amp' });
  });

  it('is paused while recovery is offered and resumes when it is answered', async () => {
    const s = setup();
    s.store.getState().setRecovery({ fileName: 'old', savedAt: 1 });
    s.store.getState().dispatch(addFeature(via('a', { x: 0, y: 0 })));
    expect(s.scheduler.queue).toHaveLength(0);
    s.store.getState().setRecovery(null);
    await s.run();
    expect(s.storage.data.has(AUTOSAVE_KEY)).toBe(true);
  });

  it('flush writes a pending change at once and is harmless without one', async () => {
    const s = setup();
    await s.autosave.flush();
    expect(s.storage.data.size).toBe(0);
    s.store.getState().dispatch(addFeature(via('a', { x: 0, y: 0 })));
    await s.autosave.flush();
    expect(s.storage.data.has(AUTOSAVE_KEY)).toBe(true);
  });

  it('reports a failed write in the status bar', async () => {
    const s = setup();
    s.storage.set = () => Promise.reject(new Error('quota exceeded'));
    s.store.getState().dispatch(addFeature(via('a', { x: 0, y: 0 })));
    await s.run();
    expect(s.store.getState().notice).toBe('Autosave failed: quota exceeded');
  });

  it('stops listening once stopped', () => {
    const s = setup();
    s.autosave.stop();
    s.store.getState().dispatch(addFeature(via('a', { x: 0, y: 0 })));
    expect(s.scheduler.queue).toHaveLength(0);
  });
});

describe('recovery from autosave', () => {
  const record = (dirty: boolean, json = serializeProject(createProject())): AutosaveRecord => ({
    json,
    fileName: 'amp',
    dirty,
    savedAt: 7,
  });

  it('offers only unsaved work', async () => {
    const storage = createMemoryStore();
    expect(await readRecovery(storage)).toBeNull();
    await storage.set(AUTOSAVE_KEY, { something: 'else' });
    expect(await readRecovery(storage)).toBeNull();
    await storage.set(AUTOSAVE_KEY, record(false));
    expect(await readRecovery(storage)).toBeNull();
    await storage.set(AUTOSAVE_KEY, record(true));
    expect(await readRecovery(storage)).toEqual(record(true));
  });

  it('restores the project and its photos, still marked unsaved', async () => {
    const source = setup();
    addPhoto(source, 'img1');
    await source.run();
    const target = fakeDeps();
    const saved = await readRecovery(source.storage);
    if (saved === null) {
      throw new Error('expected unsaved work');
    }
    await restoreAutosave({ ...target, storage: source.storage }, saved);
    const state = target.store.getState();
    expect(state.project).toEqual(source.store.getState().project);
    expect(target.images.get('img1')?.bytes).toEqual(photoBytes('10x10'));
    expect(isDirty(state)).toBe(true);
    expect(state.notice).toBe('Restored unsaved work.');
  });

  it('opens restored work without photos that are missing from storage', async () => {
    const source = setup();
    addPhoto(source, 'img1');
    await source.run();
    source.storage.data.delete('image:img1');
    const target = fakeDeps();
    await restoreAutosave(
      { ...target, storage: source.storage },
      record(true, (source.storage.data.get(AUTOSAVE_KEY) as AutosaveRecord).json),
    );
    expect(target.store.getState().notice).toContain('missing');
  });

  it('reports autosaved work that cannot be read', async () => {
    const target = fakeDeps();
    await restoreAutosave({ ...target, storage: createMemoryStore() }, record(true, '{'));
    expect(target.store.getState().notice).toContain('Could not restore');
  });

  it('clearing removes the record and every photo', async () => {
    const storage = createMemoryStore();
    await storage.set(AUTOSAVE_KEY, record(true));
    await storage.set('image:a', {});
    await clearAutosave(storage);
    expect(storage.data.size).toBe(0);
  });
});
