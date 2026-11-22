import type { Preferences } from '../platform/preferences';
import type { EditorStore } from '../ui/store';

export const OFFER_LANDMARKS_KEY = 'pcb-reverse-tracer.offer-landmarks';

/**
 * Starts with the landmark-offer choice made last time in this browser (on unless it was turned
 * off, SPEC F9) and remembers every change.
 */
export function syncLandmarkPreference(store: EditorStore, preferences: Preferences): () => void {
  if (preferences.load(OFFER_LANDMARKS_KEY) === 'off') {
    store.getState().updateSettings((s) => ({ ...s, offerLandmarks: false }));
  }
  return store.subscribe((state, previous) => {
    if (state.settings.offerLandmarks !== previous.settings.offerLandmarks) {
      preferences.save(OFFER_LANDMARKS_KEY, state.settings.offerLandmarks ? 'on' : 'off');
    }
  });
}
