import { describe, expect, it, vi } from 'vitest';
import { setLayerImage } from '../core/commands/command';
import { setOverlayOpacity } from '../core/view/viewState';
import type { ScreenSize } from '../core/geometry/viewport';
import type { ImageLookup, Renderer } from '../render/renderer';
import type { Scene } from '../render/scene';
import { createEditorStore } from '../ui/store';
import { createBoardMounter } from './boardController';
import { createImageRegistry } from './imageRegistry';

function fakeRenderer() {
  const calls = {
    render: vi.fn<(scene: Scene) => void>(),
    resize: vi.fn<(size: ScreenSize) => void>(),
    forgetImage: vi.fn<(id: string) => void>(),
    destroy: vi.fn<() => void>(),
  };
  const renderer: Renderer = {
    render: (scene) => {
      calls.render(scene);
    },
    resize: (size) => {
      calls.resize(size);
    },
    forgetImage: (id) => {
      calls.forgetImage(id);
    },
    destroy: () => {
      calls.destroy();
    },
  };
  return { renderer, calls };
}

function setup() {
  const store = createEditorStore();
  const images = createImageRegistry<string>(() => undefined);
  const { renderer, calls } = fakeRenderer();
  const frames: (() => void)[] = [];
  const lookups: ImageLookup<string>[] = [];
  const mount = createBoardMounter({
    store,
    images,
    createRenderer: (_host, lookup) => {
      lookups.push(lookup);
      return Promise.resolve(renderer);
    },
    schedule: (callback) => frames.push(callback),
  });
  const flush = () => {
    frames.splice(0).forEach((frame) => {
      frame();
    });
  };
  return { store, images, calls, mount, flush, frames, lookups };
}

const host = {} as HTMLElement;
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('board controller', () => {
  it('draws once after mounting, sized to the screen', async () => {
    const { calls, mount, flush } = setup();
    mount(host);
    await settle();
    flush();
    expect(calls.resize).toHaveBeenCalledOnce();
    expect(calls.render).toHaveBeenCalledOnce();
  });

  it('coalesces several changes into one frame and resizes only when the screen changes', async () => {
    const { store, calls, mount, flush, frames } = setup();
    mount(host);
    await settle();
    flush();
    store.getState().updateView((v) => setOverlayOpacity(v, 0.1));
    store.getState().updateView((v) => setOverlayOpacity(v, 0.2));
    expect(frames).toHaveLength(1);
    flush();
    expect(calls.render).toHaveBeenCalledTimes(2);
    expect(calls.resize).toHaveBeenCalledOnce();
    store.getState().updateView((v) => ({ ...v, screen: { width: 10, height: 10 } }));
    flush();
    expect(calls.resize).toHaveBeenLastCalledWith({ width: 10, height: 10 });
  });

  it('ignores store changes that do not affect the picture', async () => {
    const { store, mount, flush, frames } = setup();
    mount(host);
    await settle();
    flush();
    store.getState().setNotice('hi');
    expect(frames).toHaveLength(0);
  });

  it('gives the renderer the registry images and frees GPU resources of removed ones', async () => {
    const { images, calls, mount, lookups } = setup();
    mount(host);
    await settle();
    const loaded = {
      image: { id: 'a', fileName: 'a', mimeType: 'image/png', widthPx: 1, heightPx: 1 },
      tiles: [],
      bytes: new Uint8Array(),
    };
    images.add(loaded);
    expect(lookups[0]?.('a')).toBe(loaded);
    images.remove('a');
    expect(calls.forgetImage).toHaveBeenCalledWith('a');
  });

  it('stops listening and destroys the renderer on unmount', async () => {
    const { store, calls, mount, frames } = setup();
    const unmount = mount(host);
    await settle();
    unmount();
    frames.length = 0;
    store.getState().dispatch(
      setLayerImage('top', {
        id: 'a',
        fileName: 'a',
        mimeType: 'image/png',
        widthPx: 1,
        heightPx: 1,
      }),
    );
    expect(frames).toHaveLength(0);
    expect(calls.destroy).toHaveBeenCalledOnce();
  });

  it('destroys a renderer that arrives after an early unmount', async () => {
    const { calls, mount } = setup();
    const unmount = mount(host);
    unmount();
    await settle();
    expect(calls.destroy).toHaveBeenCalledOnce();
    expect(calls.render).not.toHaveBeenCalled();
  });
});
