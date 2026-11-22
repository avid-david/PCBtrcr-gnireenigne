import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { setBoardSize, setLayerImage } from '../core/commands/command';
import { addFeature } from '../core/commands/features';
import type { Vec2 } from '../core/geometry/vec2';
import { via } from '../core/model/features.test-support';
import { createProject, type Project } from '../core/model/project';
import { AlignPanel } from './AlignPanel';
import { runShortcut } from './shortcuts';
import { StatusBar } from './StatusBar';
import { EditorStoreContext, createEditorStore, type EditorStore } from './store';

const photo = (id: string) => ({
  id,
  fileName: `${id}.png`,
  mimeType: 'image/png',
  widthPx: 1000,
  heightPx: 800,
});

/** Both photos and one via at (10, 10), placed earlier. */
const project: Project = [
  setLayerImage('top', photo('t')),
  setLayerImage('bottom', photo('b')),
  addFeature(via('old', { x: 10, y: 10 })),
].reduce((p, c) => c.execute(p), createProject());

function viaStore(): EditorStore {
  let ids = 0;
  const store = createEditorStore({ project, newId: () => `id${String(++ids)}` });
  store.getState().updateSettings((s) => ({ ...s, viaSizeKnown: true }));
  store.getState().setTool('via');
  return store;
}

function placeVia(store: EditorStore, board: Vec2): void {
  store.getState().sendTool({ type: 'pointerdown', board, hitRadiusMm: 0.5, shift: false });
  store.getState().sendTool({ type: 'pointerup', board });
}

const OVER_OLD = { x: 10.3, y: 10 };

afterEach(cleanup);

describe('landmark offer: when it comes and goes', () => {
  it('appears for a via placed over another one and stays while nothing is edited', () => {
    const store = viaStore();
    placeVia(store, OVER_OLD);
    expect(store.getState().landmarkOffer).toMatchObject({ newViaId: 'id1', existingViaId: 'old' });
    store.getState().sendTool({ type: 'pointermove', board: { x: 3, y: 3 }, hitRadiusMm: 0.5 });
    store.getState().updateView((v) => ({ ...v, activeLayerId: 'bottom' }));
    expect(store.getState().landmarkOffer).not.toBeNull();
  });

  it('goes away on Keep both, Esc, any other edit, undo, the next via and a new project', () => {
    const dismissals: ((store: EditorStore) => void)[] = [
      (s) => {
        s.getState().dismissLandmark();
      },
      (s) => runShortcut(s, 'Escape'),
      (s) => {
        s.getState().dispatch(setBoardSize({ widthMm: 80, heightMm: 50 }));
      },
      (s) => {
        s.getState().undo();
      },
      (s) => {
        placeVia(s, { x: 40, y: 40 });
      },
      (s) => {
        s.getState().newProject();
      },
    ];
    for (const dismiss of dismissals) {
      const store = viaStore();
      placeVia(store, OVER_OLD);
      dismiss(store);
      expect(store.getState().landmarkOffer).toBeNull();
    }
  });

  it('shows one offer at a time: the next overlapping via replaces it', () => {
    const store = viaStore();
    placeVia(store, OVER_OLD);
    placeVia(store, { x: 9.8, y: 10 });
    expect(store.getState().landmarkOffer).toMatchObject({ newViaId: 'id2' });
  });

  it('accepting is one undo step that removes the new via and adds a match', () => {
    const store = viaStore();
    placeVia(store, OVER_OLD);
    const placed = store.getState().project;
    store.getState().acceptLandmark();
    const state = store.getState();
    expect(state.landmarkOffer).toBeNull();
    expect(state.project.features.map((f) => f.id)).toEqual(['old']);
    expect(state.project.matches).toHaveLength(1);
    expect(state.selection).toEqual([]);
    store.getState().undo();
    expect(store.getState().project).toBe(placed);
    store.getState().acceptLandmark();
    expect(store.getState().project).toBe(placed);
  });
});

describe('landmark offer: status bar and Align panel', () => {
  const renderWith = (store: EditorStore) =>
    render(
      <EditorStoreContext value={store}>
        <StatusBar />
        <AlignPanel />
      </EditorStoreContext>,
    );

  it('asks in the status bar, in display units, and accepts or keeps both', () => {
    const store = viaStore();
    renderWith(store);
    expect(screen.queryByRole('group', { name: 'Landmark offer' })).toBeNull();
    act(() => {
      placeVia(store, OVER_OLD);
    });
    const offer = screen.getByRole('group', { name: 'Landmark offer' });
    expect(offer.textContent).toContain('Overlaps via at (10, 10) mm — same via?');
    act(() => {
      store.getState().updateView((v) => ({ ...v, units: 'mil' }));
    });
    expect(offer.textContent).toContain('(393.7, 393.7) mil');
    fireEvent.click(screen.getByRole('button', { name: 'Keep both' }));
    expect(store.getState().project.features).toHaveLength(2);
    act(() => {
      placeVia(store, { x: 9.7, y: 10 });
    });
    fireEvent.click(screen.getByRole('button', { name: 'Use as landmark' }));
    expect(store.getState().project.matches).toHaveLength(1);
    expect(screen.queryByRole('group', { name: 'Landmark offer' })).toBeNull();
  });

  it('turns the offers off and on with the Align panel preference', () => {
    const store = viaStore();
    renderWith(store);
    const checkbox = screen.getByLabelText<HTMLInputElement>(
      'Offer landmarks from overlapping vias',
    );
    expect(checkbox.checked).toBe(true);
    fireEvent.click(checkbox);
    expect(store.getState().settings.offerLandmarks).toBe(false);
    act(() => {
      placeVia(store, OVER_OLD);
    });
    expect(store.getState().landmarkOffer).toBeNull();
    fireEvent.click(checkbox);
    expect(store.getState().settings.offerLandmarks).toBe(true);
  });
});
