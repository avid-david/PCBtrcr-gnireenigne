import { describe, expect, it } from 'vitest';
import { createEditorStore } from '../ui/store';
import { OFFER_LANDMARKS_KEY, syncLandmarkPreference } from './landmarkPreference';

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

const offering = (store: ReturnType<typeof createEditorStore>) =>
  store.getState().settings.offerLandmarks;

describe('landmark offer preference', () => {
  it('is on by default and when nothing is remembered', () => {
    const store = createEditorStore();
    syncLandmarkPreference(store, memory());
    expect(offering(store)).toBe(true);
  });

  it('starts with the remembered choice and remembers changes until stopped', () => {
    const store = createEditorStore();
    const prefs = memory({ [OFFER_LANDMARKS_KEY]: 'off' });
    const stop = syncLandmarkPreference(store, prefs);
    expect(offering(store)).toBe(false);
    store.getState().updateSettings((s) => ({ ...s, offerLandmarks: true }));
    expect(prefs.data.get(OFFER_LANDMARKS_KEY)).toBe('on');
    store.getState().updateSettings((s) => ({ ...s, offerLandmarks: false }));
    expect(prefs.data.get(OFFER_LANDMARKS_KEY)).toBe('off');
    store.getState().updateSettings((s) => ({ ...s, viaSizeKnown: true }));
    expect(prefs.data.size).toBe(1);
    stop();
    store.getState().updateSettings((s) => ({ ...s, offerLandmarks: true }));
    expect(prefs.data.get(OFFER_LANDMARKS_KEY)).toBe('off');
  });
});
