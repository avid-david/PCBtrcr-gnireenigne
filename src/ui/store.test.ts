import { describe, expect, it } from 'vitest';
import { setLayerImage } from '../core/commands/command';
import { setOverlayOpacity } from '../core/view/viewState';
import { createEditorStore } from './store';

const image = { id: 'i', fileName: 'a.png', mimeType: 'image/png', widthPx: 10, heightPx: 10 };

describe('editor store', () => {
  it('applies commands to the project', () => {
    const store = createEditorStore();
    store.getState().dispatch(setLayerImage('top', image));
    expect(store.getState().project.layers[0]?.image).toBe(image);
  });

  it('updates the view without touching the project', () => {
    const store = createEditorStore();
    const project = store.getState().project;
    store.getState().updateView((view) => setOverlayOpacity(view, 0.2));
    expect(store.getState().view.overlayOpacity).toBe(0.2);
    expect(store.getState().project).toBe(project);
  });

  it('new project resets project, view and notice but keeps the screen size', () => {
    const store = createEditorStore();
    store.getState().dispatch(setLayerImage('top', image));
    store.getState().updateView((view) => ({
      ...setOverlayOpacity(view, 0.9),
      screen: { width: 640, height: 480 },
    }));
    store.getState().setNotice('hello');
    store.getState().newProject();
    const state = store.getState();
    expect(state.project.layers.every((l) => l.image === null)).toBe(true);
    expect(state.view.overlayOpacity).toBe(0.5);
    expect(state.view.screen).toEqual({ width: 640, height: 480 });
    expect(state.notice).toBeNull();
  });

  it('counts project generations: only a new project increases it', () => {
    const store = createEditorStore();
    expect(store.getState().projectGeneration).toBe(0);
    store.getState().dispatch(setLayerImage('top', image));
    expect(store.getState().projectGeneration).toBe(0);
    store.getState().newProject();
    store.getState().newProject();
    expect(store.getState().projectGeneration).toBe(2);
  });
});

describe('editor store align mode', () => {
  it('ignores align events while align mode is off and resets it for a new project', () => {
    const store = createEditorStore();
    const before = store.getState();
    store.getState().sendAlign({ type: 'cancel' });
    expect(store.getState()).toBe(before);
    store.getState().setAligning(true);
    store.getState().sendAlign({ type: 'setMode', mode: 'matches' });
    expect(store.getState().align?.mode).toBe('matches');
    store.getState().newProject();
    expect(store.getState().align).toBeNull();
  });
});

describe('editor store and replaced photos', () => {
  it('re-importing a photo cancels a half-made match on it', () => {
    const store = createEditorStore();
    store.getState().dispatch(setLayerImage('top', image));
    store.getState().setAligning(true);
    store.setState({
      align: { mode: 'matches', pending: { layerId: 'top', px: { x: 1, y: 1 } }, drag: null },
    });
    store.getState().dispatch(setLayerImage('top', { ...image, id: 'replacement' }));
    expect(store.getState().align?.pending).toBeNull();
    store.getState().setAligning(false);
    store.getState().dispatch(setLayerImage('top', image));
    expect(store.getState().align).toBeNull();
  });
});
