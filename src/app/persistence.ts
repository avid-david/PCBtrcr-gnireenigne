import type { KeyValueStore } from '../platform/keyValueStore';
import type { ImageFile } from '../platform/imageLoader';
import type { EditorStore } from '../ui/store';
import type { ProjectFileActions } from '../ui/projectFileActions';
import {
  clearAutosave,
  readRecovery,
  restoreAutosave,
  startAutosave,
  type Autosave,
  type AutosaveDeps,
  type AutosaveRecord,
} from './autosave';
import {
  exportProject,
  openProjectFile,
  PROJECT_MIME_TYPE,
  saveProjectFile,
  type ProjectFileDeps,
} from './projectFiles';

export interface PersistenceDeps<F extends ImageFile, P>
  extends ProjectFileDeps<F, P>, Omit<AutosaveDeps<P>, 'storage'> {
  readonly storage: KeyValueStore;
  readonly readFile: (file: File) => Promise<Uint8Array>;
  /** Hands a file to the user (a download in the browser). */
  readonly writeFile: (fileName: string, bytes: Uint8Array, mimeType: string) => void;
}

export interface Persistence {
  readonly actions: ProjectFileActions;
  /** Looks for unsaved work from an earlier session, then starts autosaving. */
  start(): Promise<Autosave>;
}

const reasonOf = (cause: unknown) => (cause instanceof Error ? cause.message : String(cause));

/** The autosave record waiting for the user to restore or discard it. */
interface PendingRecovery {
  record: AutosaveRecord | null;
}

const reporter = (store: EditorStore, what: string) => (cause: unknown) => {
  store.getState().setNotice(`${what}: ${reasonOf(cause)}`);
};

function recoveryActions<F extends ImageFile, P>(
  deps: PersistenceDeps<F, P>,
  pending: PendingRecovery,
) {
  return {
    restoreRecovery: () => {
      const { record } = pending;
      pending.record = null;
      if (record !== null) {
        restoreAutosave(deps, record)
          .catch(reporter(deps.store, 'Could not restore'))
          // Unreadable work cannot be recovered; resume autosave rather than stay paused.
          .finally(() => {
            deps.store.getState().setRecovery(null);
          });
      }
    },
    discardRecovery: () => {
      pending.record = null;
      clearAutosave(deps.storage)
        .then(() => {
          deps.store.getState().setRecovery(null);
        })
        .catch(reporter(deps.store, 'Could not discard the autosave'));
    },
  };
}

/** Open, save, autosave and recovery, wired to the editor store. */
export function createPersistence<F extends ImageFile, P>(
  deps: PersistenceDeps<F, P>,
): Persistence {
  const pending: PendingRecovery = { record: null };
  const actions: ProjectFileActions = {
    openProject: (file) => {
      deps
        .readFile(file)
        .then((bytes) => openProjectFile(deps, { bytes, name: file.name }))
        .catch(reporter(deps.store, 'Could not open the project'));
    },
    saveProject: () => {
      saveProjectFile(deps.store, deps.images, (name, bytes) => {
        deps.writeFile(name, bytes, PROJECT_MIME_TYPE);
      });
    },
    exportProject: (exporterId) => {
      exportProject(deps.store, exporterId, deps.writeFile);
    },
    ...recoveryActions(deps, pending),
  };
  const start = async () => {
    pending.record = await readRecovery(deps.storage).catch(() => null);
    if (pending.record !== null) {
      const { fileName, savedAt } = pending.record;
      deps.store.getState().setRecovery({ fileName, savedAt });
    }
    return startAutosave(deps);
  };
  return { actions, start };
}
