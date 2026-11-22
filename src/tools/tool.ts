import type { Command } from '../core/commands/command';
import type { Rect } from '../core/geometry/rect';
import type { Vec2 } from '../core/geometry/vec2';
import type { Feature, FeatureId } from '../core/model/features';
import type { LayerId, Project } from '../core/model/project';
import type { LengthUnit } from '../core/view/units';
import type { ToolSettings } from './settings';

/**
 * How close (screen pixels) a click must be to hit or snap to something. Pointer events carry it
 * in mm as `hitRadiusMm`, so tools can turn other screen distances into mm too.
 */
export const HIT_RADIUS_PX = 10;

/** Input for a tool, already converted to board mm by the UI. */
export type ToolEvent =
  | {
      readonly type: 'pointerdown';
      readonly board: Vec2;
      readonly hitRadiusMm: number;
      readonly shift: boolean;
    }
  | { readonly type: 'pointermove'; readonly board: Vec2; readonly hitRadiusMm: number }
  | { readonly type: 'pointerup'; readonly board: Vec2 }
  | { readonly type: 'doubleclick'; readonly board: Vec2 }
  /** Enter, Backspace or Delete. */
  | { readonly type: 'key'; readonly key: string }
  /** Esc, or the tool being switched away from. */
  | { readonly type: 'cancel' };

export interface ToolContext {
  readonly project: Project;
  readonly activeLayerId: LayerId;
  readonly selection: readonly FeatureId[];
  readonly settings: ToolSettings;
  /** Unit lengths are shown in (hints). */
  readonly units: LengthUnit;
  readonly newId: () => string;
}

export interface ToolResult<S> {
  readonly state: S;
  /** Edits to apply, in order (each becomes one undo step). */
  readonly commands: readonly Command[];
  /** New selection, or `null` to keep it. */
  readonly selection: readonly FeatureId[] | null;
  /** Layer to make active, or `null` to keep it. */
  readonly activateLayer: LayerId | null;
  /** New tool defaults, e.g. the size of a via drawn to size (SPEC F7); absent keeps them. */
  readonly settings?: ToolSettings;
}

/** What a tool wants drawn on top of the board while it works (board mm). */
export interface ToolOverlay {
  /** A trace being drawn: its points so far and the cursor end. */
  readonly rubberBand: { readonly points: readonly Vec2[]; readonly widthMm: number } | null;
  /** A feature about to be placed. */
  readonly ghost: Feature | null;
  /** The anchor the cursor would snap to. */
  readonly snapTarget: Vec2 | null;
  /** A selection box being dragged. */
  readonly box: Rect | null;
}

export const NO_OVERLAY: ToolOverlay = {
  rubberBand: null,
  ghost: null,
  snapTarget: null,
  box: null,
};

/** Toolbar groups (SPEC F7), in toolbar order. */
export const TOOL_GROUPS = [
  { id: 'select', label: null },
  { id: 'connections', label: 'Connections' },
  { id: 'components', label: 'Components' },
  { id: 'annotations', label: 'Annotations' },
  { id: 'measure', label: 'Measure' },
  { id: 'align', label: 'Align' },
] as const;

export type ToolGroup = (typeof TOOL_GROUPS)[number]['id'];

/**
 * An editing tool (SPEC F3): a small state machine with its own cursor, hint and Esc to cancel.
 * Tools are pure: they return commands and never touch the project themselves.
 */
export interface Tool<S> {
  readonly label: string;
  /** Single key that selects the tool (shown in tooltips). */
  readonly shortcut: string;
  /** Toolbar group the tool is shown in (SPEC F7). */
  readonly group: ToolGroup;
  readonly cursor: 'default' | 'crosshair';
  readonly initial: S;
  step(state: S, event: ToolEvent, ctx: ToolContext): ToolResult<S>;
  hint(state: S, ctx: ToolContext): string;
  /** The project as it should be drawn right now (e.g. features being dragged). */
  preview(state: S, project: Project): Project;
  overlay(state: S, ctx: ToolContext): ToolOverlay;
}

/** One handler per event type; a tool lists only the events it reacts to. */
export type ToolHandlers<S> = {
  readonly [T in ToolEvent['type']]?: (
    state: S,
    event: Extract<ToolEvent, { type: T }>,
    ctx: ToolContext,
  ) => ToolResult<S>;
};

/** A step function that runs the handler for each event; ignored events keep the state. */
export function handle<S>(handlers: ToolHandlers<S>): Tool<S>['step'] {
  return (state, event, ctx) => {
    const handler = handlers[event.type] as
      ((state: S, event: ToolEvent, ctx: ToolContext) => ToolResult<S>) | undefined;
    return handler === undefined ? stateOnly(state) : handler(state, event, ctx);
  };
}

/** A result that only changes the tool state. */
export const stateOnly = <S>(state: S): ToolResult<S> => ({
  state,
  commands: [],
  selection: null,
  activateLayer: null,
});
