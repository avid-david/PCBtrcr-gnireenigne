import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { runShortcut } from './shortcuts';
import { createEditorStore, useEditorStore } from './store';

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
});

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
