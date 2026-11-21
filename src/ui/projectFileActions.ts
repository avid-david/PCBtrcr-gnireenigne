import { isDirty, type EditorStore } from './store';

/** What the app does when the user opens, saves or recovers a project. */
export interface ProjectFileActions {
  readonly openProject: (file: File) => void;
  readonly saveProject: () => void;
  readonly restoreRecovery: () => void;
  readonly discardRecovery: () => void;
  /** Downloads the project in a registered export format (core/export). */
  readonly exportProject: (exporterId: string) => void;
}

export const PROJECT_FILE_ACCEPT = '.pcbrt';

/** Id of the Open… file input, which Ctrl+O clicks. */
export const OPEN_PROJECT_INPUT_ID = 'open-project-input';

/** Opens the project file picker (the shortcut needs no React state, so it finds the input by id). */
export function openProjectPicker(): void {
  document.getElementById(OPEN_PROJECT_INPUT_ID)?.click();
}

/** Asks before unsaved changes would be thrown away; returns whether to go ahead. */
export function confirmDiscard(store: EditorStore, action: string): boolean {
  const state = store.getState();
  return (
    !isDirty(state) ||
    window.confirm(`"${state.fileName}" has unsaved changes. Discard them and ${action}?`)
  );
}
