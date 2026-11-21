import { useEffect } from 'react';
import { cycleActiveLayer, fitToView } from '../core/view/viewState';
import { TOOLS, TOOL_ORDER, type ToolId } from '../tools/registry';
import type { EditorStore } from './store';

interface Shortcut {
  readonly run: (store: EditorStore) => void;
  /** Whether it also works while typing in a text field (letters and edit keys must not). */
  readonly whileTyping: boolean;
}

const always = (run: Shortcut['run']): Shortcut => ({ run, whileTyping: true });
const notTyping = (run: Shortcut['run']): Shortcut => ({ run, whileTyping: false });

/** Selecting the active tool again goes back to Select (so `A` toggles align mode). */
const chooseTool = (id: ToolId) =>
  notTyping((store) => {
    store.getState().setTool(store.getState().tool.id === id ? 'select' : id);
  });

const toolKey = (key: string) =>
  notTyping((store) => {
    store.getState().sendTool({ type: 'key', key });
  });

const toolShortcuts = Object.fromEntries(
  TOOL_ORDER.map((id) => [TOOLS[id].shortcut, chooseTool(id)]),
);

/**
 * Global shortcuts by key combination ("Ctrl+Shift+z" style; single characters lower-case).
 * Tab always switches layers (decided for M1), so the browser's focus movement is suppressed.
 */
export const SHORTCUTS: Readonly<Record<string, Shortcut>> = {
  ...toolShortcuts,
  Tab: always((store) => {
    store.getState().updateView(cycleActiveLayer);
  }),
  Home: always((store) => {
    store.getState().updateView(fitToView);
  }),
  Escape: always((store) => {
    store.getState().sendTool({ type: 'cancel' });
  }),
  Enter: toolKey('Enter'),
  Backspace: toolKey('Backspace'),
  Delete: toolKey('Delete'),
  g: notTyping((store) => {
    store
      .getState()
      .updateSettings((s) => ({ ...s, grid: { ...s.grid, enabled: !s.grid.enabled } }));
  }),
  'Ctrl+z': notTyping((store) => {
    store.getState().undo();
  }),
  'Ctrl+y': notTyping((store) => {
    store.getState().redo();
  }),
  'Ctrl+Shift+z': notTyping((store) => {
    store.getState().redo();
  }),
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

/** Runs the shortcut for a combination; returns whether one ran. */
export function runShortcut(store: EditorStore, combo: string, typing = false): boolean {
  const shortcut = SHORTCUTS[combo];
  if (shortcut === undefined || (typing && !shortcut.whileTyping)) {
    return false;
  }
  shortcut.run(store);
  return true;
}

const isTextField = (target: EventTarget | null): boolean =>
  (target instanceof HTMLInputElement && target.type !== 'checkbox' && target.type !== 'range') ||
  target instanceof HTMLSelectElement;

/** Installs the global shortcuts on `window` while the component is mounted. */
export function useShortcuts(store: EditorStore): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      // Enter on a focused button presses the button, not a tool.
      if (event.key === 'Enter' && event.target instanceof HTMLButtonElement) {
        return;
      }
      const combo = comboOf(event);
      if (combo !== null && runShortcut(store, combo, isTextField(event.target))) {
        event.preventDefault();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [store]);
}
