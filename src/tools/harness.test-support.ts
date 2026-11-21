import type { Vec2 } from '../core/geometry/vec2';
import type { FeatureId } from '../core/model/features';
import type { Project } from '../core/model/project';
import { DEFAULT_SETTINGS, type ToolSettings } from './settings';
import type { Tool, ToolContext, ToolEvent } from './tool';

// Drives a tool through events like the store does: applies its commands, selection and layer.

export interface Driven<S> {
  readonly state: S;
  readonly project: Project;
  readonly selection: readonly FeatureId[];
  readonly activeLayerId: string;
}

/** Where a drive starts: a project, optionally with layer, selection and settings. */
export interface DriveStart {
  readonly project: Project;
  readonly activeLayerId?: string;
  readonly selection?: readonly FeatureId[];
  readonly settings?: ToolSettings;
}

export function drive<S>(
  tool: Tool<S>,
  from: Project | DriveStart,
  events: readonly ToolEvent[],
): Driven<S> {
  const options: DriveStart = 'project' in from ? from : { project: from };
  let ids = 0;
  const start: Driven<S> = {
    state: tool.initial,
    project: options.project,
    selection: options.selection ?? [],
    activeLayerId: options.activeLayerId ?? 'top',
  };
  return events.reduce((acc, event) => {
    const ctx = contextOf(acc, options.settings ?? DEFAULT_SETTINGS, () => `id${String(++ids)}`);
    const r = tool.step(acc.state, event, ctx);
    return {
      state: r.state,
      project: r.commands.reduce((p, c) => c.execute(p), acc.project),
      selection: r.selection ?? acc.selection,
      activeLayerId: r.activateLayer ?? acc.activeLayerId,
    };
  }, start);
}

export const contextOf = <S>(
  d: Driven<S>,
  settings: ToolSettings = DEFAULT_SETTINGS,
  newId = () => 'x',
): ToolContext => ({
  project: d.project,
  activeLayerId: d.activeLayerId,
  selection: d.selection,
  settings,
  newId,
});

export const down = (board: Vec2, shift = false): ToolEvent => ({
  type: 'pointerdown',
  board,
  hitRadiusMm: 0.5,
  shift,
});
export const move = (board: Vec2): ToolEvent => ({ type: 'pointermove', board, hitRadiusMm: 0.5 });
export const up = (board: Vec2): ToolEvent => ({ type: 'pointerup', board });
export const key = (k: string): ToolEvent => ({ type: 'key', key: k });
export const click = (board: Vec2, shift = false): ToolEvent[] => [down(board, shift), up(board)];
