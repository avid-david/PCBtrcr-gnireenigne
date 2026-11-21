import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import {
  bound,
  hole,
  smdPad,
  thPad,
  trace,
  via,
  withFeatures,
} from '../core/model/features.test-support';
import { Inspector } from './Inspector';
import { EditorStoreContext, createEditorStore, type EditorStore } from './store';
import { Toolbar } from './Toolbar';

const board = withFeatures([
  smdPad('p1', { x: 0, y: 0 }),
  via('v1', { x: 10, y: 0 }),
  trace('t1', [bound('a', 'p1'), bound('b', 'v1')]),
  hole('h1', { x: 20, y: 0 }, false),
  thPad('th', { x: 30, y: 0 }),
]);

function renderUi(store: EditorStore = createEditorStore({ project: board })) {
  render(
    <EditorStoreContext value={store}>
      <Toolbar />
      <Inspector />
    </EditorStoreContext>,
  );
  return store;
}

afterEach(cleanup);

const commit = (label: string, value: string) => {
  const input = screen.getByLabelText(label);
  fireEvent.change(input, { target: { value } });
  fireEvent.keyDown(input, { key: 'Enter' });
};

describe('Toolbar', () => {
  it('selects tools, shows shortcuts in tooltips and toggles grid snapping', () => {
    const store = renderUi();
    const trace = screen.getByRole('button', { name: 'Trace' });
    expect(trace.getAttribute('title')).toBe('Trace (T)');
    fireEvent.click(trace);
    expect(store.getState().tool.id).toBe('trace');
    expect(trace.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Snap to grid' }));
    expect(store.getState().settings.grid.enabled).toBe(true);
  });
});

describe('Inspector', () => {
  it('shows the selected feature with its net and edits it as one undo step', () => {
    const store = renderUi();
    act(() => {
      store.getState().setSelection(['v1']);
    });
    expect(screen.getByText('Via')).toBeDefined();
    expect(screen.getByLabelText('Net').textContent).toBe('Net 1 · 4 anchors');
    commit('Pad (mm)', '0,8');
    expect(store.getState().project.features[1]).toMatchObject({ padMm: 0.8 });
    expect(store.getState().settings.via.padMm).toBe(0.8);
    expect(store.getState().history.past).toHaveLength(1);
  });

  it('reverts invalid input and ignores unchanged values', () => {
    const store = renderUi();
    act(() => {
      store.getState().setSelection(['v1']);
    });
    commit('Drill (mm)', 'abc');
    expect(screen.getByLabelText<HTMLInputElement>('Drill (mm)').value).toBe('0.3');
    const input = screen.getByLabelText('Drill (mm)');
    fireEvent.blur(input);
    expect(store.getState().history.past).toHaveLength(0);
  });

  it('edits checkboxes and choices; through-hole drill only shows for through-hole pads', () => {
    const store = renderUi();
    act(() => {
      store.getState().setSelection(['h1']);
    });
    expect(screen.getByText('Not connectable')).toBeDefined();
    fireEvent.click(screen.getByLabelText('Plated (connects both layers)'));
    expect(store.getState().project.features[3]).toMatchObject({ plated: true });
    act(() => {
      store.getState().setSelection(['p1']);
    });
    expect(screen.queryByLabelText('Drill (mm)')).toBeNull();
    fireEvent.change(screen.getByLabelText('Mount'), { target: { value: 'th' } });
    expect(store.getState().project.features[0]).toMatchObject({ layerId: null });
    expect(screen.getByLabelText('Drill (mm)')).toBeDefined();
    fireEvent.change(screen.getByLabelText('Shape'), { target: { value: 'oval' } });
    fireEvent.change(screen.getByLabelText('Shape'), { target: { value: 'hexagon' } });
    expect(store.getState().project.features[0]).toMatchObject({ shape: 'oval' });
    fireEvent.change(screen.getByLabelText('Mount'), { target: { value: 'smd' } });
    expect(store.getState().project.features[0]).toMatchObject({ layerId: 'top' });
  });

  it('with several features selected offers to delete them all', () => {
    const store = renderUi();
    act(() => {
      store.getState().setSelection(['v1', 'h1']);
    });
    expect(screen.getByText('2 features selected')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(store.getState().project.features.map((f) => f.id)).toEqual(['p1', 't1', 'th']);
  });

  it('with nothing selected shows the active drawing tool’s defaults', () => {
    const store = renderUi();
    expect(screen.queryByText('New trace')).toBeNull();
    act(() => {
      store.getState().setTool('trace');
    });
    expect(screen.getByText('New trace')).toBeDefined();
    commit('Width (mm)', '0.4');
    expect(store.getState().settings.trace.widthMm).toBe(0.4);
    expect(store.getState().project).toBe(board);
  });

  it('sets the grid step', () => {
    const store = renderUi();
    commit('Grid step (mm)', '1.27');
    expect(store.getState().settings.grid.stepMm).toBe(1.27);
    fireEvent.click(screen.getByLabelText(/Snap to grid \(G\)/));
    expect(store.getState().settings.grid.enabled).toBe(true);
  });
});
