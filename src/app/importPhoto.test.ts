import { describe, expect, it } from 'vitest';
import type { LoadedImage } from '../core/model/image';
import { err, ok } from '../core/result';
import type { ImageFile, ImageLoader } from '../platform/imageLoader';
import { createEditorStore } from '../ui/store';
import { createImageRegistry } from './imageRegistry';
import { imageIdsInUse, syncImagesWithProject } from './imageSync';
import { createPhotoImporter } from './importPhoto';

const loaded = (id: string, name: string): LoadedImage<string> => ({
  image: { id, fileName: name, mimeType: 'image/png', widthPx: 1000, heightPx: 500 },
  tiles: [{ rect: { x: 0, y: 0, width: 1000, height: 500 }, pixels: `${id}-pixels` }],
  bytes: new Uint8Array(),
});

function setup(load: ImageLoader<ImageFile, string>) {
  const store = createEditorStore();
  store.getState().updateView((v) => ({ ...v, screen: { width: 800, height: 600 } }));
  const released: string[] = [];
  const images = createImageRegistry<string>((p) => released.push(p));
  syncImagesWithProject(store, images);
  return { store, images, released, importPhoto: createPhotoImporter({ store, images, load }) };
}

const file = (name: string): ImageFile => ({ name, type: 'image/png' });

/** A loader whose result the test releases by hand, to interleave other actions with loading. */
type LoadResult = Awaited<ReturnType<ImageLoader<ImageFile, string>>>;

function deferredLoader() {
  let resolveLoad: (result: LoadResult) => void = () => undefined;
  const load: ImageLoader<ImageFile, string> = () =>
    new Promise((resolve) => {
      resolveLoad = resolve;
    });
  const finish = (result: LoadResult) => {
    resolveLoad(result);
  };
  return { load, finish };
}

describe('photo import', () => {
  it('drops and frees a photo that finishes loading after a new project was started', async () => {
    const loader = deferredLoader();
    const { store, images, released, importPhoto } = setup(loader.load);
    const pending = importPhoto('top', file('old.png'));
    store.getState().newProject();
    loader.finish(ok(loaded('stale', 'old.png')));
    await pending;
    expect(store.getState().project.layers.every((l) => l.image === null)).toBe(true);
    expect(images.get('stale')).toBeUndefined();
    expect(released).toEqual(['stale-pixels']);
    expect(store.getState().notice).toBeNull();
  });

  it('does not report errors of an import from a discarded project', async () => {
    const loader = deferredLoader();
    const { store, importPhoto } = setup(loader.load);
    const pending = importPhoto('top', file('old.gif'));
    store.getState().newProject();
    loader.finish(err({ kind: 'unsupported-type', mimeType: 'image/gif' }));
    await pending;
    expect(store.getState().notice).toBeNull();
  });

  it('still applies an import when only the current project was edited meanwhile', async () => {
    const loader = deferredLoader();
    const { store, importPhoto } = setup(loader.load);
    const pending = importPhoto('top', file('top.png'));
    store.getState().updateView((v) => ({ ...v, overlayOpacity: 0.2 }));
    loader.finish(ok(loaded('a', 'top.png')));
    await pending;
    expect(store.getState().project.layers[0]?.image?.id).toBe('a');
  });

  it('puts the photo on the layer, reports it and fits the first photo', async () => {
    const { store, images, importPhoto } = setup((f) => Promise.resolve(ok(loaded('a', f.name))));
    await importPhoto('bottom', file('bottom.png'));
    const state = store.getState();
    expect(state.project.layers[1]?.image?.id).toBe('a');
    expect(images.get('a')).toBeDefined();
    expect(state.notice).toBe('Imported bottom.png');
    expect(state.view.viewport.zoom).toBeCloseTo(7.2);
  });

  it('keeps the view for later photos and keeps a replaced photo while undo needs it', async () => {
    let next = 0;
    const ids = ['a', 'b'];
    const { store, images, released, importPhoto } = setup((f) =>
      Promise.resolve(ok(loaded(ids[next++] ?? 'x', f.name))),
    );
    await importPhoto('top', file('first.png'));
    store.getState().updateView((v) => ({ ...v, viewport: { zoom: 1, offset: { x: 0, y: 0 } } }));
    await importPhoto('top', file('second.png'));
    expect(store.getState().view.viewport.zoom).toBe(1);
    // Undo can bring the first photo back, so its pixels stay until no step refers to it.
    expect(images.get('a')).toBeDefined();
    store.getState().undo();
    expect(store.getState().project.layers[0]?.image?.id).toBe('a');
    store.getState().newProject();
    expect(released.sort()).toEqual(['a-pixels', 'b-pixels']);
  });

  it('shows load errors as a notice and changes nothing else', async () => {
    const { store, importPhoto } = setup(() =>
      Promise.resolve(err({ kind: 'unsupported-type', mimeType: 'image/gif' })),
    );
    const before = store.getState().project;
    await importPhoto('top', file('a.gif'));
    expect(store.getState().project).toBe(before);
    expect(store.getState().notice).toContain('Unsupported file type "image/gif"');
  });

  it('a new project frees all photos', async () => {
    const { store, images, importPhoto } = setup((f) => Promise.resolve(ok(loaded('a', f.name))));
    await importPhoto('top', file('top.png'));
    store.getState().newProject();
    expect(images.get('a')).toBeUndefined();
    expect(imageIdsInUse(store.getState().project).size).toBe(0);
  });
});
