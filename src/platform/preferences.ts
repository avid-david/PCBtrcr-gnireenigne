/** Small per-browser settings (e.g. the display unit); never part of a project. */
export interface Preferences {
  load(key: string): string | null;
  save(key: string, value: string): void;
}

/** localStorage, ignoring browsers that block it (private windows, strict privacy settings). */
export const browserPreferences: Preferences = {
  load: (key) => {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  save: (key, value) => {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // Not remembering a preference is harmless.
    }
  },
};
