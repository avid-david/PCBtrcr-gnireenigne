import type { ChangeEvent } from 'react';
import {
  confirmDiscard,
  OPEN_PROJECT_INPUT_ID,
  PROJECT_FILE_ACCEPT,
  type ProjectFileActions,
} from './projectFileActions';
import { isDirty, useEditor, type EditorStore } from './store';

interface OpenProps {
  readonly store: EditorStore;
  readonly onOpen: (file: File) => void;
}

/** Open… button; Ctrl+O clicks its input. */
export function OpenProjectButton({ store, onOpen }: OpenProps) {
  const onChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file !== undefined && confirmDiscard(store, 'open another project')) {
      onOpen(file);
    }
  };
  return (
    <label className="button" title="Open a project (Ctrl+O)">
      Open…
      <input
        id={OPEN_PROJECT_INPUT_ID}
        className="visually-hidden"
        type="file"
        accept={PROJECT_FILE_ACCEPT}
        aria-label="Open project file"
        onChange={onChange}
      />
    </label>
  );
}

/** Save button and the project's file name, marked while it has unsaved changes. */
export function SaveProject({ onSave }: { readonly onSave: () => void }) {
  const fileName = useEditor((s) => s.fileName);
  const dirty = useEditor(isDirty);
  return (
    <>
      <button type="button" className="button" title="Save the project (Ctrl+S)" onClick={onSave}>
        Save
      </button>
      <span className="shell__file" aria-label="Project file">
        {fileName}.pcbrt
        {dirty && (
          <span className="shell__dirty" title="Unsaved changes">
            {' ●'}
            <span className="visually-hidden"> (unsaved changes)</span>
          </span>
        )}
      </span>
    </>
  );
}

/** Offers to restore work that an earlier session autosaved but never saved to a file. */
export function RecoveryBanner({ actions }: { readonly actions: ProjectFileActions }) {
  const recovery = useEditor((s) => s.recovery);
  if (recovery === null) {
    return null;
  }
  const when = new Date(recovery.savedAt).toLocaleString();
  return (
    <section className="shell__banner" aria-label="Recover unsaved work">
      <span>
        Unsaved work on “{recovery.fileName}” from {when} was found. Autosave is paused until you
        choose.
      </span>
      <button type="button" className="button button--primary" onClick={actions.restoreRecovery}>
        Restore
      </button>
      <button type="button" className="button" onClick={actions.discardRecovery}>
        Discard
      </button>
    </section>
  );
}
