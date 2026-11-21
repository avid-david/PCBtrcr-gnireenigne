import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BoardView } from './BoardView';
import { EditorStoreContext, createEditorStore } from './store';
import { wheelDeltaPx } from './useNavigation';
import { forwardToAlign } from './alignInput';
import { alignedTopProject } from '../core/alignment/fixtures.test-support';

class FakeResizeObserver {
  observe = vi.fn();
  disconnect = vi.fn();
}

function renderBoard() {
  const store = createEditorStore();
  render(
    <EditorStoreContext value={store}>
      <BoardView mountBoard={() => () => undefined} />
      <button type="button">Other control</button>
    </EditorStoreContext>,
  );
  const host = screen.getByTestId('board-host');
  const capture = vi.fn();
  host.setPointerCapture = capture;
  return { store, host, capture };
}

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', FakeResizeObserver);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('wheelDeltaPx', () => {
  it('converts line and page deltas to pixels', () => {
    expect(wheelDeltaPx({ deltaY: 3, deltaMode: 0 }, 500)).toBe(3);
    expect(wheelDeltaPx({ deltaY: 3, deltaMode: 1 }, 500)).toBe(48);
    expect(wheelDeltaPx({ deltaY: 1, deltaMode: 2 }, 500)).toBe(500);
    expect(wheelDeltaPx({ deltaY: 2, deltaMode: 7 }, 500)).toBe(2);
  });
});

describe('board navigation', () => {
  it('zooms with the wheel', () => {
    const { store, host } = renderBoard();
    const before = store.getState().view.viewport.zoom;
    const event = fireEvent.wheel(host, { deltaY: -100, clientX: 10, clientY: 10 });
    expect(event).toBe(false);
    expect(store.getState().view.viewport.zoom).toBeGreaterThan(before);
  });

  it('pans with a middle-button drag and captures the pointer', () => {
    const { store, host, capture } = renderBoard();
    fireEvent.pointerDown(host, { button: 1, pointerId: 7, clientX: 0, clientY: 0 });
    fireEvent.pointerMove(host, { clientX: 30, clientY: 40 });
    fireEvent.pointerUp(host);
    fireEvent.pointerMove(host, { clientX: 90, clientY: 90 });
    expect(store.getState().view.viewport.offset).toEqual({ x: 30, y: 40 });
    expect(capture).toHaveBeenCalledWith(7);
  });

  it('pans with space + left drag; a plain left drag does nothing', () => {
    const { store, host } = renderBoard();
    fireEvent.pointerDown(host, { button: 0, clientX: 0, clientY: 0 });
    fireEvent.pointerMove(host, { clientX: 5, clientY: 5 });
    expect(store.getState().view.viewport.offset).toEqual({ x: 0, y: 0 });
    fireEvent.pointerCancel(host);
    fireEvent.keyDown(window, { key: ' ' });
    fireEvent.pointerDown(host, { button: 0, clientX: 0, clientY: 0 });
    fireEvent.pointerMove(host, { clientX: 5, clientY: 6 });
    fireEvent.keyUp(window, { key: ' ' });
    expect(store.getState().view.viewport.offset).toEqual({ x: 5, y: 6 });
  });

  it('leaves space alone in form controls', () => {
    const { host, store } = renderBoard();
    const button = screen.getByRole('button', { name: 'Other control' });
    expect(fireEvent.keyDown(button, { key: ' ' })).toBe(true);
    fireEvent.pointerDown(host, { button: 0, clientX: 0, clientY: 0 });
    fireEvent.pointerMove(host, { clientX: 5, clientY: 5 });
    expect(store.getState().view.viewport.offset).toEqual({ x: 0, y: 0 });
  });

  it('blocks the middle-click autoscroll', () => {
    const { host } = renderBoard();
    expect(fireEvent.mouseDown(host, { button: 1 })).toBe(false);
    expect(fireEvent.mouseDown(host, { button: 0 })).toBe(true);
  });
});

describe('board input in align mode', () => {
  it('sends left clicks to the align tool in board coordinates; panning still works', () => {
    const store = createEditorStore({ project: alignedTopProject(), newId: () => 'm' });
    store.getState().setAligning(true);
    store.getState().sendAlign({ type: 'setMode', mode: 'matches' });
    store.getState().updateView((v) => ({ ...v, viewport: { zoom: 4, offset: { x: 0, y: 0 } } }));
    render(
      <EditorStoreContext value={store}>
        <BoardView mountBoard={() => () => undefined} />
      </EditorStoreContext>,
    );
    const host = screen.getByTestId('board-host');
    host.setPointerCapture = vi.fn();
    expect(host.className).toContain('board--aligning');
    fireEvent.pointerDown(host, { button: 0, clientX: 80, clientY: 40 });
    fireEvent.pointerUp(host);
    expect(store.getState().align?.pending?.layerId).toBe('top');
    expect(store.getState().view.activeLayerId).toBe('bottom');
    fireEvent.pointerDown(host, { button: 1, clientX: 0, clientY: 0 });
    fireEvent.pointerMove(host, { clientX: 10, clientY: 0 });
    fireEvent.pointerUp(host);
    expect(store.getState().view.viewport.offset).toEqual({ x: 10, y: 0 });
    expect(store.getState().align?.pending?.layerId).toBe('top');
  });

  it('ignores right clicks and does nothing outside align mode', () => {
    const store = createEditorStore({ project: alignedTopProject() });
    expect(forwardToAlign(store, { type: 'pointerdown', button: 0, point: { x: 0, y: 0 } })).toBe(
      false,
    );
    store.getState().setAligning(true);
    expect(forwardToAlign(store, { type: 'pointerdown', button: 2, point: { x: 0, y: 0 } })).toBe(
      false,
    );
    expect(forwardToAlign(store, { type: 'wheel', point: { x: 0, y: 0 }, deltaPx: 1 })).toBe(false);
    expect(forwardToAlign(store, { type: 'pointermove', point: { x: 0, y: 0 } })).toBe(true);
  });
});
