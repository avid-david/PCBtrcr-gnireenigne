import { describe, expect, it, vi } from 'vitest';
import { createImageLoader, type ImageCodec, type ImageFile } from './imageLoader';

interface FakePixels {
  readonly label: string;
}

function fakeCodec(size: { widthPx: number; heightPx: number }, decodeError?: Error) {
  const released: string[] = [];
  const codec: ImageCodec<ImageFile, FakePixels> = {
    decode: (file) =>
      decodeError === undefined
        ? Promise.resolve({ ...size, pixels: { label: file.name } })
        : Promise.reject(decodeError),
    crop: (pixels, rect) =>
      Promise.resolve({ label: `${pixels.label}@${String(rect.x)},${String(rect.y)}` }),
    release: (pixels) => released.push(pixels.label),
    read: (file) => Promise.resolve(new TextEncoder().encode(file.name)),
    newId: () => 'id-1',
  };
  return { codec, released };
}

const png = { name: 'top.png', type: 'image/png' };

describe('image loader', () => {
  it('decodes, tiles and releases the full-size pixels', async () => {
    const { codec, released } = fakeCodec({ widthPx: 6000, heightPx: 4000 });
    const result = await createImageLoader(codec)(png);
    expect(result.ok && result.value.image).toEqual({
      id: 'id-1',
      fileName: 'top.png',
      mimeType: 'image/png',
      widthPx: 6000,
      heightPx: 4000,
    });
    expect(result.ok && result.value.tiles.map((t) => t.pixels.label)).toEqual([
      'top.png@0,0',
      'top.png@4096,0',
    ]);
    expect(released).toEqual(['top.png']);
  });

  it('keeps the original file bytes and can reuse a saved image id', async () => {
    const { codec } = fakeCodec({ widthPx: 10, heightPx: 10 });
    const result = await createImageLoader(codec)(png, { imageId: 'saved-7' });
    expect(result.ok && result.value.image.id).toBe('saved-7');
    expect(result.ok && new TextDecoder().decode(result.value.bytes)).toBe('top.png');
  });

  it('refuses unsupported types without decoding', async () => {
    const { codec } = fakeCodec({ widthPx: 1, heightPx: 1 });
    const decode = vi.spyOn(codec, 'decode');
    const result = await createImageLoader(codec)({ name: 'a.gif', type: 'image/gif' });
    expect(result).toEqual({
      ok: false,
      error: { kind: 'unsupported-type', mimeType: 'image/gif' },
    });
    expect(decode).not.toHaveBeenCalled();
  });

  it('reports decode failures as errors', async () => {
    const broken = await createImageLoader(
      fakeCodec({ widthPx: 1, heightPx: 1 }, new Error('bad data')).codec,
    )(png);
    expect(broken).toEqual({ ok: false, error: { kind: 'decode-failed', reason: 'bad data' } });
  });

  it('reports tiling failures as errors and still frees the full-size pixels', async () => {
    const { codec, released } = fakeCodec({ widthPx: 10, heightPx: 10 });
    codec.crop = () => Promise.reject(new Error('out of memory'));
    const result = await createImageLoader(codec)(png);
    expect(result).toEqual({
      ok: false,
      error: { kind: 'decode-failed', reason: 'out of memory' },
    });
    expect(released).toEqual(['top.png']);
  });

  it('frees the tiles that were cut when another tile fails', async () => {
    const { codec, released } = fakeCodec({ widthPx: 6000, heightPx: 5000 });
    const crop = codec.crop.bind(codec);
    codec.crop = (pixels, rect) =>
      rect.x > 0 && rect.y > 0 ? Promise.reject(new Error('lost context')) : crop(pixels, rect);
    const result = await createImageLoader(codec)(png);
    expect(result).toEqual({ ok: false, error: { kind: 'decode-failed', reason: 'lost context' } });
    expect([...released].sort()).toEqual([
      'top.png',
      'top.png@0,0',
      'top.png@0,4096',
      'top.png@4096,0',
    ]);
  });

  it('refuses photos above the size limit and frees them', async () => {
    const { codec, released } = fakeCodec({ widthPx: 20_000, heightPx: 10_000 });
    const result = await createImageLoader(codec)(png);
    expect(result).toEqual({ ok: false, error: { kind: 'too-large', pixels: 200_000_000 } });
    expect(released).toEqual(['top.png']);
  });
});
