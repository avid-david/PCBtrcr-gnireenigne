import { describe, expect, it } from 'vitest';
import { browserPreferences } from '../platform/preferences';
import { createEditorStore } from '../ui/store';
import { syncUnitPreference, UNITS_KEY } from './unitPreference';

const memory = (initial: Record<string, string> = {}) => {
  const data = new Map(Object.entries(initial));
  return {
    data,
    load: (key: string) => data.get(key) ?? null,
    save: (key: string, value: string) => {
      data.set(key, value);
    },
  };
};

describe('unit preference', () => {
  it('starts in the remembered unit and remembers changes', () => {
    const store = createEditorStore();
    const prefs = memory({ [UNITS_KEY]: 'mil' });
    const stop = syncUnitPreference(store, prefs);
    expect(store.getState().view.units).toBe('mil');
    store.getState().updateView((view) => ({ ...view, units: 'mm' }));
    expect(prefs.data.get(UNITS_KEY)).toBe('mm');
    stop();
    store.getState().updateView((view) => ({ ...view, units: 'mil' }));
    expect(prefs.data.get(UNITS_KEY)).toBe('mm');
  });

  it('keeps mm when nothing is remembered, and survives blocked storage', () => {
    const store = createEditorStore();
    syncUnitPreference(store, memory());
    expect(store.getState().view.units).toBe('mm');
    browserPreferences.save('k', 'v');
    expect(browserPreferences.load('k')).toBe('v');
    const original = window.localStorage;
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get: () => {
        throw new Error('blocked');
      },
    });
    expect(browserPreferences.load('k')).toBeNull();
    expect(() => {
      browserPreferences.save('k', 'w');
    }).not.toThrow();
    Object.defineProperty(window, 'localStorage', { configurable: true, value: original });
  });
});
