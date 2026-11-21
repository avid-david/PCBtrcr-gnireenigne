import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { styleNet } from '../core/commands/netStyles';
import {
  bound,
  trace,
  twoPadComponent,
  via,
  withFeatures,
} from '../core/model/features.test-support';
import { AppShell } from './AppShell';
import { Inspector } from './Inspector';
import { NetsPanel } from './NetsPanel';
import { EditorStoreContext, createEditorStore, type EditorStore } from './store';

const board = withFeatures([
  { ...twoPadComponent('r', { x: 0, y: 0 }), designator: 'R1' },
  via('v', { x: 5, y: 0 }),
  trace('t', [bound('t1', 'r.2'), bound('t2', 'v')]),
]);

afterEach(cleanup);

function renderNets(store: EditorStore = createEditorStore({ project: board })) {
  const onExport = vi.fn();
  render(
    <EditorStoreContext value={store}>
      <NetsPanel onExport={onExport} />
      <Inspector />
    </EditorStoreContext>,
  );
  return { store, onExport };
}

const names = () =>
  screen.getAllByRole('textbox', { name: /^Name of / }).map((i) => (i as HTMLInputElement).value);

describe('nets panel', () => {
  it('lists nets with members, filters them and exports', () => {
    const { onExport } = renderNets();
    expect(names()).toEqual(['Net 1', 'Net 2']);
    expect(screen.getByText('2 members')).toBeDefined();
    fireEvent.change(screen.getByLabelText('Filter nets'), { target: { value: ' 2' } });
    expect(names()).toEqual(['Net 2']);
    fireEvent.click(screen.getByRole('button', { name: 'Export Netlist (CSV)' }));
    expect(onExport).toHaveBeenCalledWith('netlist-csv');
  });

  it('renames, recolours, locks and resets a net, each as one edit', () => {
    const { store } = renderNets();
    const name = screen.getByLabelText('Name of Net 2');
    fireEvent.change(name, { target: { value: '  OUT ' } });
    fireEvent.keyDown(name, { key: 'Enter' });
    expect(store.getState().project.netStyles).toEqual([
      { anchor: 'r.2', name: 'OUT', color: null, locked: false },
    ]);
    const color = screen.getByLabelText<HTMLInputElement>('Colour of OUT');
    color.value = '#00ff00';
    fireEvent(color, new Event('change'));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Lock OUT' }));
    expect(store.getState().project.netStyles[0]).toMatchObject({ color: 0x00ff00 });
    fireEvent.click(screen.getByRole('button', { name: 'Reset OUT' }));
    expect(store.getState().project.netStyles).toEqual([]);
    expect(store.getState().history.past.map((e) => e.label)).toEqual([
      'Edit net',
      'Edit net',
      'Lock net',
      'Reset net',
    ]);
  });

  it('clears a name back to the automatic one and ignores unchanged names', () => {
    const store = createEditorStore({ project: board });
    store.getState().dispatch(styleNet('v', { name: 'OUT' }));
    renderNets(store);
    const name = screen.getByLabelText('Name of OUT');
    fireEvent.blur(name);
    expect(store.getState().history.past).toHaveLength(1);
    fireEvent.change(name, { target: { value: '' } });
    fireEvent.blur(name);
    expect(store.getState().project.netStyles).toEqual([]);
  });

  it('highlights a net from the list or the inspector, and Esc clears it', () => {
    const { store } = renderNets();
    fireEvent.click(screen.getByRole('button', { name: 'Highlight Net 2' }));
    expect(store.getState().view.highlight).toBe('r.2');
    act(() => {
      store.getState().setSelection(['v']);
    });
    const inspectorButton = screen.getByRole('button', { name: 'Highlight' });
    expect(inspectorButton.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(inspectorButton);
    expect(store.getState().view.highlight).toBeNull();
  });

  it('says when there are no nets yet', () => {
    renderNets(createEditorStore());
    expect(screen.getByText(/No nets yet/)).toBeDefined();
  });
});

class FakeResizeObserver {
  observe = vi.fn();
  disconnect = vi.fn();
}

describe('shell: units, shortcuts help, side panel tabs', () => {
  beforeEach(() => {
    vi.stubGlobal('ResizeObserver', FakeResizeObserver);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function renderShell() {
    const store = createEditorStore({ project: board });
    const files = {
      openProject: vi.fn(),
      saveProject: vi.fn(),
      restoreRecovery: vi.fn(),
      discardRecovery: vi.fn(),
      exportProject: vi.fn(),
    };
    render(
      <EditorStoreContext value={store}>
        <AppShell
          appName="App"
          onImportPhoto={vi.fn()}
          mountBoard={() => () => undefined}
          files={files}
        />
      </EditorStoreContext>,
    );
    return { store, files };
  }

  it('switches between mm and mil; sizes show and parse in the unit', () => {
    const { store } = renderShell();
    act(() => {
      store.getState().setTool('trace');
    });
    fireEvent.click(screen.getByRole('button', { name: 'mil' }));
    const width = screen.getByLabelText<HTMLInputElement>('Width (mil)');
    expect(width.value).toBe('9.84');
    fireEvent.change(width, { target: { value: '12' } });
    fireEvent.keyDown(width, { key: 'Enter' });
    expect(store.getState().settings.trace.widthMm).toBeCloseTo(0.3048);
    act(() => {
      store.getState().newProject();
    });
    expect(store.getState().view.units).toBe('mil');
  });

  it('opens the shortcuts help with ? or the button, and closes it with Esc', () => {
    renderShell();
    fireEvent.keyDown(window, { key: '?' });
    const dialog = screen.getByRole('dialog', { name: 'Keyboard shortcuts' });
    expect(dialog.textContent).toContain('Ctrl+Shift+Z');
    expect(dialog.textContent).toContain('Component tool');
    expect(dialog.textContent).toContain('Save the project');
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Keyboard shortcuts' }));
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('shows the nets tab and exports through the app', () => {
    const { files } = renderShell();
    fireEvent.click(screen.getByRole('tab', { name: 'Nets' }));
    expect(screen.getByRole('tabpanel', { name: 'Nets' })).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Export Netlist (JSON)' }));
    expect(files.exportProject).toHaveBeenCalledWith('netlist-json');
    fireEvent.click(screen.getByRole('tab', { name: 'Layers' }));
    expect(screen.getByRole('tabpanel', { name: 'Layers' })).toBeDefined();
  });
});
