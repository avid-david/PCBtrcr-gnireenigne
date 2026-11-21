import type { Preferences } from '../platform/preferences';
import type { EditorStore } from '../ui/store';

export const UNITS_KEY = 'pcb-reverse-tracer.units';

/** Starts with the unit chosen last time in this browser and remembers every change. */
export function syncUnitPreference(store: EditorStore, preferences: Preferences): () => void {
  if (preferences.load(UNITS_KEY) === 'mil') {
    store.getState().updateView((view) => ({ ...view, units: 'mil' }));
  }
  return store.subscribe((state, previous) => {
    if (state.view.units !== previous.view.units) {
      preferences.save(UNITS_KEY, state.view.units);
    }
  });
}
