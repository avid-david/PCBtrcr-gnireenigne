import { describe, expect, it } from 'vitest';
import { alignState } from './editorTransitions';
import { setLayerImage } from '../core/commands/command';
import { EMPTY_HISTORY } from '../core/commands/history';
import { via } from '../core/model/features.test-support';
import { createProject } from '../core/model/project';
import { setOverlayOpacity } from '../core/view/viewState';
import { createEditorStore, DEFAULT_FILE_NAME, isDirty } from './store';

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
  it('switches align mode only while aligning, and a new project goes back to Select', () => {
    const store = createEditorStore();
    const before = store.getState();
    store.getState().setAlignMode('matches');
    expect(store.getState().tool).toBe(before.tool);
    store.getState().setTool('align');
    store.getState().setAlignMode('matches');
    expect(alignState(store.getState())?.mode).toBe('matches');
    store.getState().newProject();
    expect(store.getState().tool.id).not.toBe('align');
  });
});

describe('editor store and replaced photos', () => {
  it('re-importing a photo cancels a half-made match on it', () => {
    const store = createEditorStore();
    store.getState().dispatch(setLayerImage('top', image));
    store.getState().setTool('align');
    store.setState({
      tool: {
        id: 'align',
        state: { mode: 'matches', pending: { layerId: 'top', px: { x: 1, y: 1 } }, drag: null },
      },
    });
    store.getState().dispatch(setLayerImage('top', { ...image, id: 'replacement' }));
    expect(alignState(store.getState())?.pending).toBeNull();
    store.getState().setTool('select');
    store.getState().dispatch(setLayerImage('top', image));
    expect(store.getState().tool.id).not.toBe('align');
  });
});

describe('editor store files', () => {
  it('a new store has a saved, unnamed project', () => {
    const state = createEditorStore().getState();
    expect(state.fileName).toBe(DEFAULT_FILE_NAME);
    expect(isDirty(state)).toBe(false);
  });

  it('edits make the project dirty and undoing them makes it clean again', () => {
    const store = createEditorStore();
    store.getState().dispatch(setLayerImage('top', image));
    expect(isDirty(store.getState())).toBe(true);
    store.getState().undo();
    expect(isDirty(store.getState())).toBe(false);
  });

  it('marking a project saved records it and its file name', () => {
    const store = createEditorStore();
    store.getState().dispatch(setLayerImage('top', image));
    store.getState().markSaved(store.getState().project, 'amp');
    expect(isDirty(store.getState())).toBe(false);
    expect(store.getState().fileName).toBe('amp');
  });

  it('loading a project starts a fresh history, a new generation and clears recovery', () => {
    const store = createEditorStore();
    store.getState().dispatch(setLayerImage('top', image));
    store.getState().setRecovery({ fileName: 'x', savedAt: 1 });
    const opened = createProject();
    store.getState().loadProject(opened, { fileName: 'amp', saved: true });
    const state = store.getState();
    expect(state.project).toBe(opened);
    expect(state.history).toBe(EMPTY_HISTORY);
    expect(state.projectGeneration).toBe(1);
    expect(state.recovery).toBeNull();
    expect(state.fileName).toBe('amp');
    expect(isDirty(state)).toBe(false);
  });

  it('a project restored from autosave stays dirty until saved', () => {
    const store = createEditorStore();
    store.getState().loadProject(createProject(), { fileName: 'amp', saved: false });
    expect(isDirty(store.getState())).toBe(true);
  });

  it('a new project forgets the file name', () => {
    const store = createEditorStore();
    store.getState().markSaved(store.getState().project, 'amp');
    store.getState().newProject();
    expect(store.getState().fileName).toBe(DEFAULT_FILE_NAME);
    expect(isDirty(store.getState())).toBe(false);
  });
});

describe('editor store via size (SPEC F7)', () => {
  const withVias = {
    ...createProject(),
    features: [via('a', { x: 0, y: 0 }), { ...via('b', { x: 5, y: 0 }), padMm: 1.2, drillMm: 0.5 }],
  };

  it('a loaded project with vias makes its newest via the known default size', () => {
    const store = createEditorStore();
    expect(store.getState().settings.viaSizeKnown).toBe(false);
    store.getState().loadProject(withVias, { fileName: 'b', saved: true });
    expect(store.getState().settings.via).toEqual({ padMm: 1.2, drillMm: 0.5 });
    expect(store.getState().settings.viaSizeKnown).toBe(true);
  });

  it('a project without vias leaves the size unknown; a new project keeps a known one', () => {
    const store = createEditorStore();
    store.getState().loadProject(createProject(), { fileName: 'b', saved: true });
    expect(store.getState().settings.viaSizeKnown).toBe(false);
    store.getState().loadProject(withVias, { fileName: 'b', saved: true });
    store.getState().newProject();
    expect(store.getState().settings.viaSizeKnown).toBe(true);
  });

  it('a via drawn to size becomes the default for the next one', () => {
    const store = createEditorStore({ newId: () => 'v' });
    store.getState().setTool('via');
    store
      .getState()
      .sendTool({ type: 'pointerdown', board: { x: 0, y: 0 }, hitRadiusMm: 0.5, shift: false });
    store.getState().sendTool({ type: 'pointermove', board: { x: 0.5, y: 0 }, hitRadiusMm: 0.5 });
    store.getState().sendTool({ type: 'pointerup', board: { x: 0.5, y: 0 } });
    expect(store.getState().settings.via).toEqual({ padMm: 1, drillMm: 0.5 });
    expect(store.getState().settings.viaSizeKnown).toBe(true);
  });
});
