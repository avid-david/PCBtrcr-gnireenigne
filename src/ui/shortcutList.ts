import type { ShortcutMap } from './shortcuts';

export interface ShortcutRow {
  /** How the keys are written for people, e.g. "Ctrl+Shift+Z". */
  readonly keys: string;
  readonly description: string;
}

/** "Ctrl+Shift+z" → "Ctrl+Shift+Z"; single letters are shown upper-case like on keycaps. */
export const keysLabel = (combo: string): string =>
  combo
    .split('+')
    .map((part) => (part.length === 1 ? part.toUpperCase() : part))
    .join('+');

/** Mouse actions that are not key shortcuts but belong in the same help. */
export const MOUSE_ROWS: readonly ShortcutRow[] = [
  { keys: 'Wheel', description: 'Zoom around the cursor' },
  { keys: 'Middle-drag, Space+drag', description: 'Pan' },
  { keys: 'Shift+click', description: 'Add to or remove from the selection' },
  { keys: 'Double-click', description: 'Finish a trace, plane or silkscreen line' },
];

/** The help rows for a shortcut map, in its order, built from its descriptions. */
export const shortcutRows = (map: ShortcutMap): ShortcutRow[] =>
  Object.entries(map).map(([combo, s]) => ({ keys: keysLabel(combo), description: s.description }));
