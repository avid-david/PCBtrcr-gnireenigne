import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import {
  plane,
  square,
  twoPadComponent,
  via,
  withFeatures,
} from '../core/model/features.test-support';
import type { Feature } from '../core/model/features';
import { isContentVisible } from '../core/view/viewState';
import { Inspector } from './Inspector';
import { LayerPanel } from './LayerPanel';
import { EditorStoreContext, createEditorStore, type EditorStore } from './store';

const board = withFeatures([
  twoPadComponent('r', { x: 0, y: 0 }),
  via('v1', { x: 2, y: 2 }),
  via('v2', { x: 50, y: 50 }),
  plane('p', square(-5, -5, 10)),
  { kind: 'text', id: 'n', layerId: 'top', at: { x: 0, y: 0 }, text: 'old', heightMm: 1 },
]);

function renderUi(store: EditorStore = createEditorStore({ project: board })) {
  render(
    <EditorStoreContext value={store}>
      <LayerPanel>
        <Inspector />
      </LayerPanel>
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

const feature = (store: EditorStore, id: string): Feature | undefined =>
  store.getState().project.features.find((f) => f.id === id);

const select = (store: EditorStore, ids: string[]) => {
  act(() => {
    store.getState().setSelection(ids);
  });
};

describe('footprint picker', () => {
  it('chooses a family, resets its parameters and prefix, and refuses out-of-range values', () => {
    const store = renderUi();
    act(() => {
      store.getState().setTool('component');
    });
    fireEvent.change(screen.getByLabelText('Footprint'), { target: { value: 'pin-header' } });
    expect(store.getState().settings.component).toMatchObject({
      familyId: 'pin-header',
      prefix: 'J',
    });
    commit('Pins per row (1–40)', '41');
    expect(store.getState().settings.component.params.pins).toBe(4);
    commit('Pins per row (1–40)', '10');
    fireEvent.change(screen.getByLabelText('Rows'), { target: { value: '2' } });
    expect(store.getState().settings.component.params).toMatchObject({ rows: '2', pins: 10 });
    commit('Designator prefix', 'cn');
    commit('Value', 'Debug');
    expect(store.getState().settings.component).toMatchObject({ prefix: 'CN', value: 'Debug' });
    commit('Designator prefix', 'not a prefix');
    expect(store.getState().settings.component.prefix).toBe('CN');
    fireEvent.change(screen.getByLabelText('Footprint'), { target: { value: 'missing' } });
    expect(store.getState().settings.component.familyId).toBe('pin-header');
  });
});

describe('component and plane inspector', () => {
  it('edits designator, value and rotation, and rotates or flips', () => {
    const store = renderUi();
    select(store, ['r']);
    expect(screen.getByText('Each pad is on its own net.')).toBeDefined();
    commit('Designator', ' R9 ');
    commit('Value', '4k7');
    commit('Rotation (°, clockwise)', '-90');
    expect(feature(store, 'r')).toMatchObject({ designator: 'R9', value: '4k7', rotationDeg: 270 });
    commit('Rotation (°, clockwise)', 'abc');
    expect(feature(store, 'r')).toMatchObject({ rotationDeg: 270 });
    fireEvent.click(screen.getByRole('button', { name: 'Rotate 90°' }));
    expect(feature(store, 'r')).toMatchObject({ rotationDeg: 0 });
    fireEvent.click(screen.getByRole('button', { name: 'Flip side' }));
    expect(feature(store, 'r')).toMatchObject({ layerId: 'bottom', flipped: true });
    expect(store.getState().view.activeLayerId).toBe('bottom');
  });

  it('attaches anchors inside a plane and detaches them', () => {
    const store = renderUi();
    select(store, ['p']);
    expect(screen.getByText(/On no net until/)).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Attach anchors inside outline' }));
    expect(feature(store, 'p')).toMatchObject({ attached: ['r.1', 'r.2', 'v1'] });
    expect(screen.getByLabelText('Net')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Detach all' }));
    expect(feature(store, 'p')).toMatchObject({ attached: [] });
  });

  it('attaches selected anchors to the one selected plane', () => {
    const store = renderUi();
    select(store, ['p', 'v2', 'n']);
    fireEvent.click(screen.getByRole('button', { name: 'Attach 1 to plane' }));
    expect(feature(store, 'p')).toMatchObject({ attached: ['v2'] });
    expect(
      screen.getByRole<HTMLButtonElement>('button', { name: 'Attach 0 to plane' }).disabled,
    ).toBe(true);
    select(store, ['v1', 'v2']);
    expect(screen.queryByRole('button', { name: /to plane/ })).toBeNull();
  });

  it('edits the text of a note', () => {
    const store = renderUi();
    select(store, ['n']);
    commit('Text', 'new');
    expect(feature(store, 'n')).toMatchObject({ text: 'new' });
    expect(store.getState().settings.text.text).toBe('new');
  });
});

describe('silkscreen tool and layer toggles', () => {
  it('switches the silkscreen tool between lines and text', () => {
    const store = renderUi();
    act(() => {
      store.getState().setTool('silk');
    });
    expect(screen.getByText('New silkscreen line')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Text' }));
    expect(store.getState().settings.silk.mode).toBe('text');
    expect(screen.getByText('New silkscreen text')).toBeDefined();
  });

  it('shows and hides copper, silkscreen and notes per layer', () => {
    const store = renderUi();
    const [copperTop] = screen.getAllByLabelText('Show copper');
    fireEvent.click(copperTop ?? document.body);
    expect(isContentVisible(store.getState().view, 'top', 'copper')).toBe(false);
    fireEvent.click(screen.getAllByLabelText('Show notes')[1] ?? document.body);
    expect(isContentVisible(store.getState().view, 'bottom', 'text')).toBe(false);
    fireEvent.click(copperTop ?? document.body);
    expect(isContentVisible(store.getState().view, 'top', 'copper')).toBe(true);
  });
});
