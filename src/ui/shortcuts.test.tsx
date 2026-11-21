import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { runShortcut, useShortcuts } from './shortcuts';
import { EditorStoreContext, createEditorStore, useEditorStore } from './store';

afterEach(cleanup);

describe('shortcuts', () => {
  it('runs known shortcuts and reports unknown keys', () => {
    const store = createEditorStore();
    expect(runShortcut(store, 'Tab')).toBe(true);
    expect(store.getState().view.activeLayerId).toBe('bottom');
    const before = store.getState();
    expect(runShortcut(store, 'q')).toBe(false);
    expect(store.getState()).toBe(before);
  });

  it('A toggles align mode, but not while typing in a text field', () => {
    const store = createEditorStore();
    expect(runShortcut(store, 'a')).toBe(true);
    expect(store.getState().align).not.toBeNull();
    expect(runShortcut(store, 'A', true)).toBe(false);
    expect(store.getState().align).not.toBeNull();
    expect(runShortcut(store, 'A')).toBe(true);
    expect(store.getState().align).toBeNull();
  });

  it('Escape cancels a pending match click, also while typing', () => {
    const store = createEditorStore();
    store.getState().setAligning(true);
    store.setState({
      align: { mode: 'matches', pending: { layerId: 'top', px: { x: 1, y: 1 } }, drag: null },
    });
    expect(runShortcut(store, 'Escape', true)).toBe(true);
    expect(store.getState().align?.pending).toBeNull();
  });

  it('only treats text inputs as typing (not checkboxes or sliders)', () => {
    const store = createEditorStore();
    const { container } = render(
      <EditorStoreContext value={store}>
        <Shortcuts />
        <input aria-label="text" />
        <input type="checkbox" aria-label="box" />
      </EditorStoreContext>,
    );
    const [text, box] = Array.from(container.querySelectorAll('input'));
    fireEvent.keyDown(text ?? window, { key: 'a' });
    expect(store.getState().align).toBeNull();
    fireEvent.keyDown(box ?? window, { key: 'a' });
    expect(store.getState().align).not.toBeNull();
  });
});

function Shortcuts() {
  useShortcuts(useEditorStore());
  return null;
}

describe('useEditorStore', () => {
  it('fails loudly without a provider', () => {
    function Orphan() {
      useEditorStore();
      return null;
    }
    expect(() => render(<Orphan />)).toThrow(
      'useEditorStore must be used inside EditorStoreContext',
    );
  });
});
