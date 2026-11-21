import { describe, expect, it } from 'vitest';
import { serializeProject } from '../core/io/projectFile';
import { createProject } from '../core/model/project';
import { createMemoryStore } from '../platform/keyValueStore.test-support';
import { AUTOSAVE_KEY, type AutosaveRecord } from './autosave';
import { fakeDeps } from './fakePhotos.test-support';
import { createPersistence } from './persistence';

const unsaved: AutosaveRecord = {
  json: serializeProject({ ...createProject(), board: { widthMm: 10, heightMm: 5 } }),
  fileName: 'amp',
  dirty: true,
  savedAt: 7,
};

/** Waits until pending promise callbacks have run. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

function setup(record?: AutosaveRecord) {
  const deps = fakeDeps();
  const storage = createMemoryStore();
  if (record !== undefined) {
    storage.data.set(AUTOSAVE_KEY, record);
  }
  const written: string[] = [];
  const persistence = createPersistence({
    ...deps,
    storage,
    schedule: () => () => undefined,
    now: () => 0,
    readFile: (file) => file.arrayBuffer().then((b) => new Uint8Array(b)),
    writeFile: (name) => written.push(name),
  });
  return { ...deps, storage, persistence, written };
}

describe('persistence', () => {
  it('offers recovery at start when the autosave holds unsaved work', async () => {
    const s = setup(unsaved);
    await s.persistence.start();
    expect(s.store.getState().recovery).toEqual({ fileName: 'amp', savedAt: 7 });
  });

  it('offers nothing when the autosave was saved to a file', async () => {
    const s = setup({ ...unsaved, dirty: false });
    await s.persistence.start();
    expect(s.store.getState().recovery).toBeNull();
  });

  it('restores the offered work', async () => {
    const s = setup(unsaved);
    await s.persistence.start();
    s.persistence.actions.restoreRecovery();
    await settle();
    expect(s.store.getState().project.board).toEqual({ widthMm: 10, heightMm: 5 });
    expect(s.store.getState().recovery).toBeNull();
    s.persistence.actions.restoreRecovery();
  });

  it('discards the offered work from storage', async () => {
    const s = setup(unsaved);
    await s.persistence.start();
    s.persistence.actions.discardRecovery();
    await settle();
    expect(s.storage.data.size).toBe(0);
    expect(s.store.getState().recovery).toBeNull();
  });

  it('saves through the platform writer', () => {
    const s = setup();
    s.persistence.actions.saveProject();
    expect(s.written).toEqual(['board.pcbrt']);
  });

  it('opens a picked file and reports one that cannot be read', async () => {
    const s = setup();
    s.persistence.actions.openProject(new File(['nonsense'], 'x.pcbrt'));
    await settle();
    expect(s.store.getState().notice).toContain('not a PCB Reverse Tracer project file');
    const broken = { name: 'y.pcbrt', arrayBuffer: () => Promise.reject(new Error('gone')) };
    s.persistence.actions.openProject(broken as unknown as File);
    await settle();
    expect(s.store.getState().notice).toBe('Could not open the project: gone');
  });
});
