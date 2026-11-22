import type { Command } from '../core/commands/command';
import { execute, redo, undo, type History, type Step } from '../core/commands/history';
import { withNetStyles } from '../core/commands/netStyles';
import { describeMerges, type MergeReport } from '../core/connectivity/netStyles';
import type { FeatureId } from '../core/model/features';
import type { Project } from '../core/model/project';
import { setActiveLayer } from '../core/view/viewState';
import { reconcileAlign, type AlignState } from '../tools/align';
import { activate, stepTool, type ActiveTool } from '../tools/registry';
import type { ToolSettings } from '../tools/settings';
import type { ToolContext, ToolEvent } from '../tools/tool';
import type { ViewState } from '../core/view/viewState';

/** The part of the editor state that edits and tools change (pure data, no actions). */
export interface EditorData {
  readonly project: Project;
  readonly history: History;
  readonly view: ViewState;
  readonly tool: ActiveTool;
  readonly selection: readonly FeatureId[];
  readonly settings: ToolSettings;
}

/** The align-mode state when the align tool is active. */
export const alignState = (s: Pick<EditorData, 'tool'>): AlignState | null =>
  s.tool.id === 'align' ? s.tool.state : null;

/** Context a tool sees. */
export const toolContext = (s: EditorData, newId: () => string): ToolContext => ({
  project: s.project,
  activeLayerId: s.view.activeLayerId,
  selection: s.selection,
  settings: s.settings,
  units: s.view.units,
  newId,
});

/** Selection without features that no longer exist (deleted, undone). */
const pruneSelection = (
  selection: readonly FeatureId[],
  project: Project,
): readonly FeatureId[] => {
  const kept = selection.filter((id) => project.features.some((f) => f.id === id));
  return kept.length === selection.length ? selection : kept;
};

/** Align state tied to a replaced photo or deleted point is dropped after an edit. */
function reconcileTool(tool: ActiveTool, before: Project, after: Project): ActiveTool {
  return tool.id === 'align'
    ? { id: 'align', state: reconcileAlign(tool.state, before, after) }
    : tool;
}

/**
 * Runs commands, each as one undo step, with net styles kept consistent (docs/adr/0008). When a
 * merge drops a net's name or colour, `notice` says which net kept its own.
 */
export function applyCommands(
  s: EditorData,
  commands: readonly Command[],
): Partial<EditorData> & { notice?: string } {
  const merges: MergeReport[] = [];
  const record = (m: readonly MergeReport[]) => merges.push(...m);
  const step = commands.reduce<Step>(
    (acc, c) => execute(acc.project, acc.history, withNetStyles(c, record)),
    { project: s.project, history: s.history },
  );
  const notice = describeMerges(merges);
  return {
    ...step,
    selection: pruneSelection(s.selection, step.project),
    tool: reconcileTool(s.tool, s.project, step.project),
    ...(notice === null ? {} : { notice }),
  };
}

/** Undo or redo: unfinished tool work refers to the old project, so the tool starts over. */
export function travel(s: EditorData, direction: 'undo' | 'redo'): Partial<EditorData> {
  const step = (direction === 'undo' ? undo : redo)(s.project, s.history);
  if (step === null) {
    return {};
  }
  return {
    ...step,
    selection: pruneSelection(s.selection, step.project),
    tool: activate(s.tool.id),
  };
}

/** Feeds an event to the active tool and applies what it asks for. */
export function sendToTool(
  s: EditorData,
  event: ToolEvent,
  newId: () => string,
): Partial<EditorData> {
  const { active, result } = stepTool(s.tool, event, toolContext(s, newId));
  const edited = applyCommands({ ...s, tool: active }, result.commands);
  const project = edited.project ?? s.project;
  const layer = result.activateLayer;
  return {
    ...edited,
    selection: pruneSelection(result.selection ?? edited.selection ?? s.selection, project),
    view: layer === null ? s.view : setActiveLayer(s.view, project, layer),
  };
}
