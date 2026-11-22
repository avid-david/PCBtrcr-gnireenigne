import { cleanup, fireEvent, render } from '@testing-library/react';
import { alignState } from './editorTransitions';
import { afterEach, describe, expect, it } from 'vitest';
import { comboOf, runShortcut, useShortcuts } from './shortcuts';
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
    expect(store.getState().tool.id).toBe('align');
    expect(runShortcut(store, 'a', { typing: true })).toBe(false);
    expect(store.getState().tool.id).toBe('align');
    expect(runShortcut(store, 'a')).toBe(true);
    expect(store.getState().tool.id).toBe('select');
  });

  it('names key combinations with Ctrl and Shift, ignoring Alt', () => {
    const key = (
      k: string,
      mods: Partial<Record<'ctrlKey' | 'metaKey' | 'shiftKey' | 'altKey', boolean>> = {},
    ) =>
      comboOf({ key: k, ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, ...mods });
    expect(key('T', { shiftKey: true })).toBe('Shift+t');
    expect(key('Z', { ctrlKey: true, shiftKey: true })).toBe('Ctrl+Shift+z');
    expect(key('y', { metaKey: true })).toBe('Ctrl+y');
    expect(key('Tab')).toBe('Tab');
    expect(key('Tab', { shiftKey: true })).toBe('Shift+Tab');
    expect(key('a', { altKey: true })).toBeNull();
  });

  it('runs the plain key for a Shift combination without a binding of its own', () => {
    const store = createEditorStore();
    expect(runShortcut(store, 'Shift+t')).toBe(true);
    expect(store.getState().tool.id).toBe('trace');
    expect(runShortcut(store, 'Shift+Tab')).toBe(true);
    expect(store.getState().view.activeLayerId).toBe('bottom');
    expect(runShortcut(store, 'Shift+q')).toBe(false);
    expect(runShortcut(store, 'Ctrl+Shift+y')).toBe(false);
    expect(runShortcut(store, 'Shift+t', { typing: true })).toBe(false);
  });

  it('Shift+V picks the Via tool armed, also when it is already active', () => {
    const store = createEditorStore();
    store.getState().updateSettings((s) => ({ ...s, viaSizeKnown: true }));
    expect(runShortcut(store, 'Shift+v')).toBe(true);
    expect(store.getState().tool).toMatchObject({ id: 'via', state: { armed: true } });
    store.getState().sendTool({ type: 'cancel' });
    expect(store.getState().tool).toMatchObject({ id: 'via', state: { armed: false } });
    runShortcut(store, 'Shift+v');
    expect(store.getState().tool).toMatchObject({ id: 'via', state: { armed: true } });
    expect(runShortcut(store, 'Shift+v', { typing: true })).toBe(false);
  });

  it('selects tools, toggles the grid, and undoes/redoes', () => {
    const store = createEditorStore({ newId: () => 'v1' });
    runShortcut(store, 'v');
    expect(store.getState().tool.id).toBe('via');
    // A fresh session knows no via size, so the first via is drawn by dragging (SPEC F7).
    store
      .getState()
      .sendTool({ type: 'pointerdown', board: { x: 1, y: 1 }, hitRadiusMm: 1, shift: false });
    store.getState().sendTool({ type: 'pointermove', board: { x: 2, y: 1 }, hitRadiusMm: 1 });
    store.getState().sendTool({ type: 'pointerup', board: { x: 2, y: 1 } });
    expect(store.getState().project.features).toHaveLength(1);
    runShortcut(store, 'Ctrl+z');
    expect(store.getState().project.features).toHaveLength(0);
    runShortcut(store, 'Ctrl+y');
    expect(store.getState().project.features).toHaveLength(1);
    runShortcut(store, 'Ctrl+z');
    runShortcut(store, 'Ctrl+Shift+z');
    expect(store.getState().project.features).toHaveLength(1);
    runShortcut(store, 'g');
    expect(store.getState().settings.grid.enabled).toBe(true);
    runShortcut(store, 's');
    store.getState().setSelection(['v1']);
    runShortcut(store, 'Delete');
    expect(store.getState().project.features).toHaveLength(0);
    runShortcut(store, 'Enter');
    runShortcut(store, 'Backspace');
    runShortcut(store, 'Home');
  });

  it('Escape cancels a pending match click, also while typing', () => {
    const store = createEditorStore();
    store.getState().setTool('align');
    store.setState({
      tool: {
        id: 'align',
        state: { mode: 'matches', pending: { layerId: 'top', px: { x: 1, y: 1 } }, drag: null },
      },
    });
    expect(runShortcut(store, 'Escape', { typing: true })).toBe(true);
    expect(alignState(store.getState())?.pending).toBeNull();
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
    expect(store.getState().tool.id).not.toBe('align');
    fireEvent.keyDown(box ?? window, { key: 'a' });
    expect(store.getState().tool.id).toBe('align');
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
