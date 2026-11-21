import { createContext, useContext } from 'react';
import { useStore } from 'zustand';
import { createStore, type StoreApi } from 'zustand/vanilla';
import type { Command } from '../core/commands/command';
import { createProject, type Project } from '../core/model/project';
import { createViewState, type ViewState } from '../core/view/viewState';

/** Editor state: the project (edited only via commands) and how it is being viewed. */
export interface EditorState {
  readonly project: Project;
  readonly view: ViewState;
  /** Short message for the status bar, e.g. an import error. */
  readonly notice: string | null;
  dispatch(command: Command): void;
  updateView(update: (view: ViewState, project: Project) => ViewState): void;
  newProject(): void;
  setNotice(notice: string | null): void;
}

export type EditorStore = StoreApi<EditorState>;

/** Creates an editor store; one per app (tests create their own). */
export function createEditorStore(project: Project = createProject()): EditorStore {
  return createStore<EditorState>()((set) => ({
    project,
    view: createViewState(project),
    notice: null,
    dispatch: (command) => {
      set((s) => ({ project: command.execute(s.project) }));
    },
    updateView: (update) => {
      set((s) => ({ view: update(s.view, s.project) }));
    },
    newProject: () => {
      set((s) => {
        const fresh = createProject();
        return {
          project: fresh,
          view: { ...createViewState(fresh), screen: s.view.screen },
          notice: null,
        };
      });
    },
    setNotice: (notice) => {
      set({ notice });
    },
  }));
}

export const EditorStoreContext = createContext<EditorStore | null>(null);

/** The store provided by the nearest `EditorStoreContext`. */
export function useEditorStore(): EditorStore {
  const store = useContext(EditorStoreContext);
  if (store === null) {
    throw new Error('useEditorStore must be used inside EditorStoreContext');
  }
  return store;
}

/** Subscribes a component to a slice of the editor state. */
export function useEditor<T>(selector: (state: EditorState) => T): T {
  return useStore(useEditorStore(), selector);
}
