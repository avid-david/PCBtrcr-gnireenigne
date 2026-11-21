import { strToU8, unzipSync, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { setLayerImage } from '../core/commands/command';
import { addFeature } from '../core/commands/features';
import { writeArchive } from '../core/io/archive';
import { serializeProject } from '../core/io/projectFile';
import { via } from '../core/model/features.test-support';
import { isDirty } from '../ui/store';
import {
  fakeDeps,
  loadedPhoto,
  photoBytes,
  sourceImage,
  type FakeDeps,
} from './fakePhotos.test-support';
import { openProjectFile, packProject, projectNameOf, saveProjectFile } from './projectFiles';

/** A store with a photo on the top layer and one via. */
function editedDeps(): FakeDeps {
  const deps = fakeDeps();
  deps.images.add(loadedPhoto('img1', '10x10'));
  deps.store.getState().dispatch(setLayerImage('top', sourceImage('img1', '10x10')));
  deps.store.getState().dispatch(addFeature(via('v1', { x: 1, y: 2 })));
  return deps;
}

function saved(deps: FakeDeps) {
  const files: { name: string; bytes: Uint8Array }[] = [];
  saveProjectFile(deps.store, deps.images, (name, bytes) => files.push({ name, bytes }));
  const file = files[0];
  if (file === undefined) {
    throw new Error('nothing was written');
  }
  return file;
}

describe('saving and opening project files', () => {
  it('saves the project with its photos and marks it saved', () => {
    const deps = editedDeps();
    const file = saved(deps);
    expect(file.name).toBe('board.pcbrt');
    expect(isDirty(deps.store.getState())).toBe(false);
    expect(deps.store.getState().notice).toBe('Saved board.pcbrt');
  });

  it('opens a saved file into an identical project with the same photo bytes', async () => {
    const source = editedDeps();
    const file = saved(source);
    const target = fakeDeps();
    await openProjectFile(target, { bytes: file.bytes, name: 'amp.pcbrt' });
    const state = target.store.getState();
    expect(state.project).toEqual(source.store.getState().project);
    expect(target.images.get('img1')?.bytes).toEqual(photoBytes('10x10'));
    expect(state.fileName).toBe('amp');
    expect(isDirty(state)).toBe(false);
    expect(state.notice).toBe('Opened amp');
  });

  it('opens a project whose photo is missing and says so', async () => {
    const source = editedDeps();
    const bytes = writeArchive(serializeProject(source.store.getState().project), []);
    const target = fakeDeps();
    await openProjectFile(target, { bytes, name: 'amp.pcbrt' });
    expect(target.store.getState().project.layers[0]?.image?.id).toBe('img1');
    expect(target.store.getState().notice).toContain('img1.png is missing');
  });

  it('keeps photos it cannot show, so saving again does not drop them', async () => {
    const project = editedDeps().store.getState().project;
    for (const [content, message] of [
      ['broken', 'Could not read the photo'],
      ['20x10', 'does not match its size'],
    ] as const) {
      const target = fakeDeps();
      const bytes = writeArchive(serializeProject(project), [
        { imageId: 'img1', mimeType: 'image/png', bytes: photoBytes(content) },
      ]);
      await openProjectFile(target, { bytes, name: 'a.pcbrt' });
      expect(target.store.getState().notice).toContain(message);
      expect(target.store.getState().notice).toContain('stays in the project file');
      expect(target.images.get('img1')?.tiles).toEqual([]);
      const resaved = unzipSync(saved(target).bytes);
      expect(Array.from(resaved['images/img1.png'] ?? [])).toEqual(Array.from(photoBytes(content)));
    }
  });

  it('reports files that are not projects and keeps the current project', async () => {
    const deps = editedDeps();
    const before = deps.store.getState().project;
    await openProjectFile(deps, { bytes: strToU8('plain text'), name: 'notes.txt' });
    expect(deps.store.getState().notice).toContain('not a PCB Reverse Tracer project file');
    const badJson = zipSync({ 'project.json': strToU8('{') });
    await openProjectFile(deps, { bytes: badJson, name: 'x.pcbrt' });
    expect(deps.store.getState().notice).toContain('not valid JSON');
    expect(deps.store.getState().project).toBe(before);
  });

  it('drops a file that finishes loading after a new project was started', async () => {
    const file = saved(editedDeps());
    const target = fakeDeps();
    const opening = openProjectFile(target, { bytes: file.bytes, name: 'amp.pcbrt' });
    target.store.getState().newProject();
    await opening;
    expect(target.store.getState().project.features).toEqual([]);
    expect(target.released).toEqual(['img1-pixels']);
  });

  it('packs only photos that are loaded', () => {
    const deps = editedDeps();
    deps.images.remove('img1');
    expect(() => packProject(deps.store.getState().project, deps.images)).not.toThrow();
  });

  it('names a project after its file', () => {
    expect(projectNameOf('amp.pcbrt')).toBe('amp');
    expect(projectNameOf('AMP.PCBRT')).toBe('AMP');
    expect(projectNameOf('amp.zip')).toBe('amp.zip');
  });
});
