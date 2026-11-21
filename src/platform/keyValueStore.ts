import { createStore, del, get, keys, set } from 'idb-keyval';

/** Durable key-value storage for autosave; values must be structured-cloneable. */
export interface KeyValueStore {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
  delete(key: string): Promise<void>;
  keys(): Promise<string[]>;
}

/**
 * IndexedDB through idb-keyval: localStorage holds only about 5 MB, too little for photos.
 * The database is private to this app's origin.
 */
export function createIndexedDbStore(): KeyValueStore {
  const store = createStore('pcb-reverse-tracer', 'autosave');
  return {
    get: (key) => get<unknown>(key, store),
    set: (key, value) => set(key, value, store),
    delete: (key) => del(key, store),
    keys: async () => (await keys(store)).map(String),
  };
}
