import { createContext, useContext } from 'react';
import { useStore } from 'zustand';
import { createStore, type StoreApi } from 'zustand/vanilla';
import type { Command } from '../core/commands/command';
import { EMPTY_HISTORY } from '../core/commands/history';
import type { FeatureId } from '../core/model/features';
import { createProject, type Project } from '../core/model/project';
import { createViewState, fitToView, type ViewState } from '../core/view/viewState';
import { alignStep, type AlignMode } from '../tools/align';
import { activate, type ToolId } from '../tools/registry';
import { DEFAULT_SETTINGS, type ToolSettings } from '../tools/settings';
import type { ToolEvent } from '../tools/tool';
import {
  applyCommands,
  sendToTool,
  toolContext,
  travel,
  type EditorData,
} from './editorTransitions';

/** Editor state: the project (edited only via commands), its history and how it is viewed. */
export interface EditorState extends EditorData {
  /** Short message for the status bar, e.g. an import error. */
  readonly notice: string | null;
  /**
   * Increases with every new project. Async work (e.g. a photo import) compares it before and
   * after, because layer ids repeat across projects and cannot tell projects apart.
   */
  readonly projectGeneration: number;
  dispatch(command: Command): void;
  undo(): void;
  redo(): void;
  updateView(update: (view: ViewState, project: Project) => ViewState): void;
  setTool(id: ToolId): void;
  sendTool(event: ToolEvent): void;
  /** Switches align mode between placing corners and matching points. */
  setAlignMode(mode: AlignMode): void;
  setSelection(ids: readonly FeatureId[]): void;
  updateSettings(update: (settings: ToolSettings) => ToolSettings): void;
  newProject(): void;
  setNotice(notice: string | null): void;
  /** Name of the project file, without `.pcbrt`. */
  readonly fileName: string;
  /** The project as last saved to (or opened from) a file; `null` if it never was. */
  readonly savedProject: Project | null;
  /** Unsaved work found in autosave at startup, waiting for the user to restore or discard it. */
  readonly recovery: Recovery | null;
  /** Replaces the project with one opened from a file or autosave; undo history starts over. */
  loadProject(project: Project, options: LoadOptions): void;
  markSaved(project: Project, fileName: string): void;
  setRecovery(recovery: Recovery | null): void;
}

export interface Recovery {
  readonly fileName: string;
  /** When the autosave was written (ms since the epoch). */
  readonly savedAt: number;
}

export interface LoadOptions {
  readonly fileName: string;
  /** Whether the project matches a file on disk (false for work restored from autosave). */
  readonly saved: boolean;
}

/** File name of a project that was never saved. */
export const DEFAULT_FILE_NAME = 'board';

/** Whether the project has changes that are not in a file. */
export const isDirty = (s: Pick<EditorState, 'project' | 'savedProject'>): boolean =>
  s.project !== s.savedProject;

export type EditorStore = StoreApi<EditorState>;

export interface EditorStoreOptions {
  readonly project?: Project;
  /** Id generator for new features and matches; injectable so tests are deterministic. */
  readonly newId?: () => string;
}

/** Everything except the screen size, units and settings starts over with another project. */
const replaceProject = (s: EditorState, project: Project): Partial<EditorState> => ({
  project,
  history: EMPTY_HISTORY,
  view: fitToView(
    { ...createViewState(project), screen: s.view.screen, units: s.view.units },
    project,
  ),
  tool: activate('select'),
  selection: [],
  notice: null,
  projectGeneration: s.projectGeneration + 1,
});

const freshProject = (s: EditorState): Partial<EditorState> => {
  const fresh = createProject();
  return { ...replaceProject(s, fresh), savedProject: fresh, fileName: DEFAULT_FILE_NAME };
};

/** Actions that open, save or recover a project. */
const fileActions = (set: Set) => ({
  newProject: () => {
    set(freshProject);
  },
  loadProject: (project: Project, { fileName, saved }: LoadOptions) => {
    set((s) => ({
      ...replaceProject(s, project),
      savedProject: saved ? project : null,
      fileName,
      recovery: null,
    }));
  },
  markSaved: (savedProject: Project, fileName: string) => {
    set({ savedProject, fileName });
  },
  setRecovery: (recovery: Recovery | null) => {
    set({ recovery });
  },
});

type Set = StoreApi<EditorState>['setState'];

/** Actions that edit the project or drive the active tool. */
const editingActions = (set: Set, newId: () => string) => ({
  dispatch: (command: Command) => {
    set((s) => applyCommands(s, [command]));
  },
  undo: () => {
    set((s) => travel(s, 'undo'));
  },
  redo: () => {
    set((s) => travel(s, 'redo'));
  },
  setTool: (id: ToolId) => {
    set({ tool: activate(id) });
  },
  sendTool: (event: ToolEvent) => {
    set((s) => sendToTool(s, event, newId));
  },
  setAlignMode: (mode: AlignMode) => {
    set((s) =>
      s.tool.id === 'align'
        ? {
            tool: {
              id: 'align',
              state: alignStep(s.tool.state, { type: 'setMode', mode }, toolContext(s, newId))
                .state,
            },
          }
        : {},
    );
  },
});

/** Actions that change how the project is shown or set up. */
const viewActions = (set: Set) => ({
  updateView: (update: (view: ViewState, project: Project) => ViewState) => {
    set((s) => ({ view: update(s.view, s.project) }));
  },
  setSelection: (ids: readonly FeatureId[]) => {
    set({ selection: ids });
  },
  updateSettings: (update: (settings: ToolSettings) => ToolSettings) => {
    set((s) => ({ settings: update(s.settings) }));
  },
  setNotice: (notice: string | null) => {
    set({ notice });
  },
});

/** Creates an editor store; one per app (tests create their own). */
export function createEditorStore(options: EditorStoreOptions = {}): EditorStore {
  const project = options.project ?? createProject();
  const newId = options.newId ?? (() => crypto.randomUUID());
  return createStore<EditorState>()((set) => ({
    project,
    history: EMPTY_HISTORY,
    view: createViewState(project),
    tool: activate('select'),
    selection: [],
    settings: DEFAULT_SETTINGS,
    notice: null,
    projectGeneration: 0,
    fileName: DEFAULT_FILE_NAME,
    savedProject: project,
    recovery: null,
    ...editingActions(set, newId),
    ...viewActions(set),
    ...fileActions(set),
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
