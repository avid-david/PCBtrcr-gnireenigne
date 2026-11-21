import { createContext, useContext } from 'react';
import { useStore } from 'zustand';
import { createStore, type StoreApi } from 'zustand/vanilla';
import type { Command } from '../core/commands/command';
import { EMPTY_HISTORY } from '../core/commands/history';
import type { FeatureId } from '../core/model/features';
import { createProject, type Project } from '../core/model/project';
import { createViewState, type ViewState } from '../core/view/viewState';
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
}

export type EditorStore = StoreApi<EditorState>;

export interface EditorStoreOptions {
  readonly project?: Project;
  /** Id generator for new features and matches; injectable so tests are deterministic. */
  readonly newId?: () => string;
}

/** Everything except the screen size starts over with a new project. */
const freshProject = (s: EditorState): Partial<EditorState> => {
  const fresh = createProject();
  return {
    project: fresh,
    history: EMPTY_HISTORY,
    view: { ...createViewState(fresh), screen: s.view.screen },
    tool: activate('select'),
    selection: [],
    notice: null,
    projectGeneration: s.projectGeneration + 1,
  };
};

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
  newProject: () => {
    set(freshProject);
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
    ...editingActions(set, newId),
    ...viewActions(set),
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
