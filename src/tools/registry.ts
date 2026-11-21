import type { Project } from '../core/model/project';
import type { AlignState } from './align';
import { alignTool } from './alignTool';
import { holeTool, padTool, pointTool, viaTool, type PlaceState } from './place';
import { selectTool, type SelectState } from './select';
import type { Tool, ToolContext, ToolEvent, ToolOverlay, ToolResult } from './tool';
import { traceTool, type TraceState } from './trace';

/** The state type of every registered tool. Add a tool here and in `TOOLS`. */
export interface ToolStates {
  readonly select: SelectState;
  readonly trace: TraceState;
  readonly via: PlaceState;
  readonly pad: PlaceState;
  readonly point: PlaceState;
  readonly hole: PlaceState;
  readonly align: AlignState;
}

export type ToolId = keyof ToolStates;

export const TOOLS: { readonly [K in ToolId]: Tool<ToolStates[K]> } = {
  select: selectTool,
  trace: traceTool,
  via: viaTool,
  pad: padTool,
  point: pointTool,
  hole: holeTool,
  align: alignTool,
};

/** Toolbar order. */
export const TOOL_ORDER: readonly ToolId[] = [
  'select',
  'trace',
  'via',
  'pad',
  'point',
  'hole',
  'align',
];

/** The active tool together with its state (the pair keeps their types in step). */
export type ActiveTool = {
  readonly [K in ToolId]: { readonly id: K; readonly state: ToolStates[K] };
}[ToolId];

/** The tool behind an active tool, with its state type erased for generic use. */
const toolOf = (active: ActiveTool) => TOOLS[active.id] as Tool<ActiveTool['state']>;

/** A freshly selected tool. */
export const activate = (id: ToolId): ActiveTool =>
  ({ id, state: TOOLS[id].initial }) as ActiveTool;

/** Advances the active tool by one event. */
export function stepTool(
  active: ActiveTool,
  event: ToolEvent,
  ctx: ToolContext,
): { readonly active: ActiveTool; readonly result: ToolResult<unknown> } {
  const result = toolOf(active).step(active.state, event, ctx);
  return { active: { id: active.id, state: result.state } as ActiveTool, result };
}

/** The active tool's hint text. */
export const toolHint = (active: ActiveTool, ctx: ToolContext): string =>
  toolOf(active).hint(active.state, ctx);

/** The project as the active tool wants it drawn (live preview). */
export const toolPreview = (active: ActiveTool, project: Project): Project =>
  toolOf(active).preview(active.state, project);

/** What the active tool draws on top of the board. */
export const toolOverlay = (active: ActiveTool, ctx: ToolContext): ToolOverlay =>
  toolOf(active).overlay(active.state, ctx);

/** Shortcut key → tool, from the registry. */
export const toolForKey = (key: string): ToolId | undefined =>
  TOOL_ORDER.find((id) => TOOLS[id].shortcut === key);
