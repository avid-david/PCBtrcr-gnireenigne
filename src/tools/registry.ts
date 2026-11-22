import type { Project } from '../core/model/project';
import type { AlignState } from './align';
import { alignTool } from './alignTool';
import { componentTool, type ComponentState } from './component';
import {
  holeTool,
  padTool,
  pointTool,
  textTool,
  type PlaceState,
  type TemplateKind,
} from './place';
import { planeTool, silkTool, type PolylineState } from './polyline';
import type { ToolSettings } from './settings';
import { selectTool, type SelectState } from './select';
import {
  TOOL_GROUPS,
  type Tool,
  type ToolContext,
  type ToolEvent,
  type ToolGroup,
  type ToolOverlay,
  type ToolResult,
} from './tool';
import { traceTool, type TraceState } from './trace';
import { viaTool, type ViaState } from './via';

/** The state type of every registered tool. Add a tool here and in `TOOLS`. */
export interface ToolStates {
  readonly select: SelectState;
  readonly trace: TraceState;
  readonly via: ViaState;
  readonly pad: PlaceState;
  readonly point: PlaceState;
  readonly hole: PlaceState;
  readonly plane: PolylineState;
  readonly component: ComponentState;
  readonly silk: PolylineState;
  readonly text: PlaceState;
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
  plane: planeTool,
  component: componentTool,
  silk: silkTool,
  text: textTool,
  align: alignTool,
};

/** Toolbar order: grouped as in `TOOL_GROUPS`, in registration order within a group. */
export const TOOL_ORDER: readonly ToolId[] = [
  'select',
  'trace',
  'via',
  'pad',
  'point',
  'hole',
  'plane',
  'component',
  'silk',
  'text',
  'align',
];

export interface ToolbarGroup {
  readonly id: ToolGroup;
  /** Caption above the group, or `null` for none (Select). */
  readonly label: string | null;
  readonly tools: readonly ToolId[];
}

/** The toolbar's groups with their tools; groups without a registered tool are left out. */
export const toolbarGroups = (): readonly ToolbarGroup[] =>
  TOOL_GROUPS.map((g) => ({
    id: g.id,
    label: g.label,
    tools: TOOL_ORDER.filter((id) => TOOLS[id].group === g.id),
  })).filter((g) => g.tools.length > 0);

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

const TEMPLATE_KINDS: Partial<Readonly<Record<ToolId, (s: ToolSettings) => TemplateKind>>> = {
  trace: () => 'trace',
  via: () => 'via',
  pad: () => 'pad',
  point: () => 'point',
  hole: () => 'hole',
  text: () => 'text',
  silk: (s) => (s.silk.mode === 'line' ? 'silkLine' : 'silkText'),
};

/** The feature kind a drawing tool creates (its defaults are shown in the inspector), if any. */
export const toolTemplateKind = (id: ToolId, settings: ToolSettings): TemplateKind | null =>
  TEMPLATE_KINDS[id]?.(settings) ?? null;
