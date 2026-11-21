import { useEffect } from 'react';
import { cycleActiveLayer, fitToView } from '../core/view/viewState';
import { TOOLS, TOOL_ORDER, type ToolId } from '../tools/registry';
import type { EditorStore } from './store';

export interface Shortcut {
  readonly run: (store: EditorStore) => void;
  /** Whether it also works while typing in a text field (letters and edit keys must not). */
  readonly whileTyping: boolean;
  /** One line for the shortcuts help overlay. */
  readonly description: string;
}

export const always = (description: string, run: Shortcut['run']): Shortcut => ({
  run,
  whileTyping: true,
  description,
});
const notTyping = (description: string, run: Shortcut['run']): Shortcut => ({
  run,
  whileTyping: false,
  description,
});

/** Selecting the active tool again goes back to Select (so `A` toggles align mode). */
const chooseTool = (id: ToolId) =>
  notTyping(`${TOOLS[id].label} tool`, (store) => {
    store.getState().setTool(store.getState().tool.id === id ? 'select' : id);
  });

const toolKey = (key: string, description: string) =>
  notTyping(description, (store) => {
    store.getState().sendTool({ type: 'key', key });
  });

const toolShortcuts = Object.fromEntries(
  TOOL_ORDER.map((id) => [TOOLS[id].shortcut, chooseTool(id)]),
);

/**
 * Global shortcuts by key combination ("Ctrl+Shift+z" style; single characters lower-case).
 * Tab always switches layers (decided for M1), so the browser's focus movement is suppressed.
 */
export type ShortcutMap = Readonly<Record<string, Shortcut>>;

const redo = notTyping('Redo', (store) => {
  store.getState().redo();
});

export const SHORTCUTS: ShortcutMap = {
  ...toolShortcuts,
  Tab: always('Switch the active layer', (store) => {
    store.getState().updateView(cycleActiveLayer);
  }),
  Home: always('Fit the board to the view', (store) => {
    store.getState().updateView(fitToView);
  }),
  Escape: always('Cancel what the tool is doing; clear the net highlight', (store) => {
    store.getState().sendTool({ type: 'cancel' });
    store
      .getState()
      .updateView((view) => (view.highlight === null ? view : { ...view, highlight: null }));
  }),
  Enter: toolKey('Enter', 'Finish a trace, plane or silkscreen line'),
  Backspace: toolKey('Backspace', 'Remove the last point; delete the selection'),
  Delete: toolKey('Delete', 'Delete the selection'),
  r: toolKey('r', 'Rotate the selected (or next) component 90°'),
  f: toolKey('f', 'Flip the selected (or next) component to the other side'),
  g: notTyping('Snap to grid on or off', (store) => {
    store
      .getState()
      .updateSettings((s) => ({ ...s, grid: { ...s.grid, enabled: !s.grid.enabled } }));
  }),
  'Ctrl+z': notTyping('Undo', (store) => {
    store.getState().undo();
  }),
  'Ctrl+y': redo,
  'Ctrl+Shift+z': redo,
};

/** The shortcut name of a key event, e.g. "Ctrl+Shift+z", "Tab" or "t". */
export function comboOf(
  e: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'shiftKey' | 'altKey'>,
): string | null {
  if (e.altKey) {
    return null;
  }
  const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  const ctrl = e.ctrlKey || e.metaKey;
  return ctrl ? `Ctrl+${e.shiftKey ? 'Shift+' : ''}${key}` : key;
}

export interface RunOptions {
  /** Whether focus is in a text field. */
  readonly typing?: boolean;
  /** Shortcuts the app adds (e.g. Ctrl+S, which needs platform file access). */
  readonly extra?: ShortcutMap;
}

/** Runs the shortcut for a combination; returns whether one ran. */
export function runShortcut(
  store: EditorStore,
  combo: string,
  { typing = false, extra = {} }: RunOptions = {},
): boolean {
  const shortcut = extra[combo] ?? SHORTCUTS[combo];
  if (shortcut === undefined || (typing && !shortcut.whileTyping)) {
    return false;
  }
  shortcut.run(store);
  return true;
}

const isTextField = (target: EventTarget | null): boolean =>
  (target instanceof HTMLInputElement && target.type !== 'checkbox' && target.type !== 'range') ||
  target instanceof HTMLSelectElement;

const NO_EXTRA: ShortcutMap = {};

/** Installs the global shortcuts on `window` while the component is mounted. */
export function useShortcuts(store: EditorStore, extra: ShortcutMap = NO_EXTRA): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      // Enter on a focused button presses the button, not a tool.
      if (event.key === 'Enter' && event.target instanceof HTMLButtonElement) {
        return;
      }
      const combo = comboOf(event);
      const typing = isTextField(event.target);
      if (combo !== null && runShortcut(store, combo, { typing, extra })) {
        event.preventDefault();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [store, extra]);
}
