import type { ImageCodec } from './imageLoader';

/** Browser implementation of image decoding and tiling via `createImageBitmap`. */
export const browserImageCodec: ImageCodec<File, ImageBitmap> = {
  decode: async (file) => {
    const pixels = await createImageBitmap(file);
    return { widthPx: pixels.width, heightPx: pixels.height, pixels };
  },
  read: async (file) => new Uint8Array(await file.arrayBuffer()),
  crop: (pixels, rect) => createImageBitmap(pixels, rect.x, rect.y, rect.width, rect.height),
  release: (pixels) => {
    pixels.close();
  },
  newId: () => crypto.randomUUID(),
};
