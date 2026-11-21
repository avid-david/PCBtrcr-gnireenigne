import { useEffect } from 'react';
import { cycleActiveLayer, fitToView } from '../core/view/viewState';
import type { EditorStore } from './store';

type ShortcutAction = (store: EditorStore) => void;

/**
 * Global shortcuts, looked up by `KeyboardEvent.key`. Tab always switches layers (decided for
 * M1: no focus-traversal exception), so the browser's Tab focus movement is suppressed.
 */
export const SHORTCUTS: Readonly<Record<string, ShortcutAction>> = {
  Tab: (store) => {
    store.getState().updateView(cycleActiveLayer);
  },
  Home: (store) => {
    store.getState().updateView(fitToView);
  },
};

/** Runs the shortcut for a key; returns whether one ran. */
export function runShortcut(store: EditorStore, key: string): boolean {
  const action = SHORTCUTS[key];
  if (action === undefined) {
    return false;
  }
  action(store);
  return true;
}

/** Installs the global shortcuts on `window` while the component is mounted. */
export function useShortcuts(store: EditorStore): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const modified = event.ctrlKey || event.altKey || event.metaKey;
      if (!modified && runShortcut(store, event.key)) {
        event.preventDefault();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [store]);
}
