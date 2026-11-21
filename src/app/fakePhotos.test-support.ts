import type { LoadedImage } from '../core/model/image';
import type { SourceImage } from '../core/model/project';
import { err, ok } from '../core/result';
import type { ImageLoader } from '../platform/imageLoader';
import { createImageRegistry, type ImageRegistry } from './imageRegistry';
import type { ProjectFileDeps } from './projectFiles';
import { createEditorStore, type EditorStore } from '../ui/store';

/** A photo file in tests: the bytes say how big the photo is, e.g. "10x20" or "broken". */
export interface FakeFile {
  readonly name: string;
  readonly type: string;
  readonly bytes: Uint8Array;
}

export const photoBytes = (text: string): Uint8Array => new TextEncoder().encode(text);

export const sourceImage = (id: string, size = '10x10'): SourceImage => {
  const [w = 0, h = 0] = size.split('x').map(Number);
  return { id, fileName: `${id}.png`, mimeType: 'image/png', widthPx: w, heightPx: h };
};

export const loadedPhoto = (id: string, size = '10x10'): LoadedImage<string> => ({
  image: sourceImage(id, size),
  tiles: [{ rect: { x: 0, y: 0, width: 1, height: 1 }, pixels: `${id}-pixels` }],
  bytes: photoBytes(size),
});

/** Decodes "WxH" bytes; anything else fails like a corrupt photo. */
export const fakeLoad: ImageLoader<FakeFile, string> = (file, options = {}) => {
  const text = new TextDecoder().decode(file.bytes);
  if (!/^\d+x\d+$/.test(text)) {
    return Promise.resolve(err({ kind: 'decode-failed', reason: 'corrupt' }));
  }
  const id = options.imageId ?? 'new-id';
  const loaded = loadedPhoto(id, text);
  return Promise.resolve(ok({ ...loaded, image: { ...loaded.image, fileName: file.name } }));
};

export interface FakeDeps extends ProjectFileDeps<FakeFile, string> {
  readonly store: EditorStore;
  readonly images: ImageRegistry<string>;
  readonly released: string[];
}

export function fakeDeps(store: EditorStore = createEditorStore()): FakeDeps {
  const released: string[] = [];
  return {
    store,
    images: createImageRegistry<string>((pixels) => released.push(pixels)),
    load: fakeLoad,
    toFile: (bytes, image) => ({ name: image.fileName, type: image.mimeType, bytes }),
    released,
  };
}
