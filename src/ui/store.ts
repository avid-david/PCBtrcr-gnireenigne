import { createContext, useContext } from 'react';
import { useStore } from 'zustand';
import { createStore, type StoreApi } from 'zustand/vanilla';
import type { Command } from '../core/commands/command';
import { createProject, type Project } from '../core/model/project';
import { createViewState, setActiveLayer, type ViewState } from '../core/view/viewState';
import { INITIAL_ALIGN, alignStep, type AlignEvent, type AlignState } from '../tools/align';

/** Editor state: the project (edited only via commands) and how it is being viewed. */
export interface EditorState {
  readonly project: Project;
  readonly view: ViewState;
  /** Align mode state, or `null` while align mode is off. */
  readonly align: AlignState | null;
  /** Short message for the status bar, e.g. an import error. */
  readonly notice: string | null;
  /**
   * Increases with every new project. Async work (e.g. a photo import) compares it before and
   * after, because layer ids repeat across projects and cannot tell projects apart.
   */
  readonly projectGeneration: number;
  dispatch(command: Command): void;
  updateView(update: (view: ViewState, project: Project) => ViewState): void;
  /** Turns align mode on or off. */
  setAligning(on: boolean): void;
  /** Feeds an event to the align tool and applies its commands (no-op outside align mode). */
  sendAlign(event: AlignEvent): void;
  newProject(): void;
  setNotice(notice: string | null): void;
}

export type EditorStore = StoreApi<EditorState>;

export interface EditorStoreOptions {
  readonly project?: Project;
  /** Id generator for new matches; injectable so tests are deterministic. */
  readonly newId?: () => string;
}

/** Applies one align-tool step to the state (align mode must be on). */
function stepAlign(
  s: EditorState,
  align: AlignState,
  step: { readonly event: AlignEvent; readonly newId: () => string },
): Partial<EditorState> {
  const ctx = { project: s.project, activeLayerId: s.view.activeLayerId, newId: step.newId };
  const { state, commands, activateLayer } = alignStep(align, step.event, ctx);
  const project = commands.reduce((p, c) => c.execute(p), s.project);
  const view = activateLayer === null ? s.view : setActiveLayer(s.view, project, activateLayer);
  return { align: state, project, view };
}

/** State after "New project": everything reset except the screen size. */
function freshProjectState(s: EditorState): Partial<EditorState> {
  const fresh = createProject();
  return {
    project: fresh,
    view: { ...createViewState(fresh), screen: s.view.screen },
    align: null,
    notice: null,
    projectGeneration: s.projectGeneration + 1,
  };
}

/** Creates an editor store; one per app (tests create their own). */
export function createEditorStore(options: EditorStoreOptions = {}): EditorStore {
  const project = options.project ?? createProject();
  const newId = options.newId ?? (() => crypto.randomUUID());
  return createStore<EditorState>()((set, get) => ({
    project,
    view: createViewState(project),
    align: null,
    notice: null,
    projectGeneration: 0,
    dispatch: (command) => {
      set((s) => ({ project: command.execute(s.project) }));
    },
    updateView: (update) => {
      set((s) => ({ view: update(s.view, s.project) }));
    },
    setAligning: (on) => {
      set({ align: on ? INITIAL_ALIGN : null });
    },
    sendAlign: (event) => {
      const align = get().align;
      if (align !== null) {
        set((s) => stepAlign(s, align, { event, newId }));
      }
    },
    newProject: () => {
      set(freshProjectState);
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
