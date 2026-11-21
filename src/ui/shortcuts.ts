import { useEffect } from 'react';
import { cycleActiveLayer, fitToView } from '../core/view/viewState';
import type { EditorStore } from './store';

interface Shortcut {
  readonly run: (store: EditorStore) => void;
  /** Whether it also works while typing in a text field (letters must not). */
  readonly whileTyping: boolean;
}

const toggleAlign = (store: EditorStore) => {
  store.getState().setAligning(store.getState().align === null);
};

/**
 * Global shortcuts, looked up by `KeyboardEvent.key`. Tab always switches layers (decided for
 * M1: no focus-traversal exception), so the browser's Tab focus movement is suppressed.
 */
export const SHORTCUTS: Readonly<Record<string, Shortcut>> = {
  Tab: {
    run: (store) => {
      store.getState().updateView(cycleActiveLayer);
    },
    whileTyping: true,
  },
  Home: {
    run: (store) => {
      store.getState().updateView(fitToView);
    },
    whileTyping: true,
  },
  a: { run: toggleAlign, whileTyping: false },
  A: { run: toggleAlign, whileTyping: false },
  Escape: {
    run: (store) => {
      store.getState().sendAlign({ type: 'cancel' });
    },
    whileTyping: true,
  },
};

/** Runs the shortcut for a key; returns whether one ran. */
export function runShortcut(store: EditorStore, key: string, typing = false): boolean {
  const shortcut = SHORTCUTS[key];
  if (shortcut === undefined || (typing && !shortcut.whileTyping)) {
    return false;
  }
  shortcut.run(store);
  return true;
}

const isTextField = (target: EventTarget | null): boolean =>
  target instanceof HTMLInputElement && target.type !== 'checkbox' && target.type !== 'range';

/** Installs the global shortcuts on `window` while the component is mounted. */
export function useShortcuts(store: EditorStore): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const modified = event.ctrlKey || event.altKey || event.metaKey;
      if (!modified && runShortcut(store, event.key, isTextField(event.target))) {
        event.preventDefault();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [store]);
}
