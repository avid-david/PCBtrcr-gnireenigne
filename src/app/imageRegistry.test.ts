import { describe, expect, it, vi } from 'vitest';
import type { LoadedImage } from '../core/model/image';
import { createImageRegistry } from './imageRegistry';

const loaded = (id: string): LoadedImage<string> => ({
  image: { id, fileName: `${id}.png`, mimeType: 'image/png', widthPx: 1, heightPx: 1 },
  tiles: [
    { rect: { x: 0, y: 0, width: 1, height: 1 }, pixels: `${id}-tile0` },
    { rect: { x: 1, y: 0, width: 1, height: 1 }, pixels: `${id}-tile1` },
  ],
  bytes: new Uint8Array(),
});

describe('image registry', () => {
  it('stores images by id', () => {
    const registry = createImageRegistry<string>(() => undefined);
    registry.add(loaded('a'));
    expect(registry.get('a')?.image.fileName).toBe('a.png');
    expect(registry.get('b')).toBeUndefined();
  });

  it('remove releases every tile and notifies listeners; unknown ids are ignored', () => {
    const release = vi.fn();
    const registry = createImageRegistry<string>(release);
    const listener = vi.fn();
    const unsubscribe = registry.onRemove(listener);
    registry.add(loaded('a'));
    registry.remove('a');
    registry.remove('a');
    expect(release.mock.calls).toEqual([['a-tile0'], ['a-tile1']]);
    expect(listener).toHaveBeenCalledOnce();
    expect(registry.get('a')).toBeUndefined();
    unsubscribe();
    registry.add(loaded('b'));
    registry.remove('b');
    expect(listener).toHaveBeenCalledOnce();
  });

  it('adding an image under a stored id frees the old one first', () => {
    const release = vi.fn();
    const registry = createImageRegistry<string>(release);
    const listener = vi.fn();
    registry.onRemove(listener);
    const first = loaded('a');
    registry.add(first);
    registry.add(first);
    expect(release).not.toHaveBeenCalled();
    const second = loaded('a');
    registry.add(second);
    expect(release).toHaveBeenCalledTimes(2);
    expect(listener).toHaveBeenCalledWith('a');
    expect(registry.get('a')).toBe(second);
  });

  it('retainOnly removes images that are not kept', () => {
    const registry = createImageRegistry<string>(() => undefined);
    ['a', 'b', 'c'].forEach((id) => {
      registry.add(loaded(id));
    });
    registry.retainOnly(new Set(['b']));
    expect(['a', 'b', 'c'].map((id) => registry.get(id) !== undefined)).toEqual([
      false,
      true,
      false,
    ]);
  });
});
