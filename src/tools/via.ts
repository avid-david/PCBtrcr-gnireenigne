import { distance } from '../core/geometry/distance';
import type { Vec2 } from '../core/geometry/vec2';
import type { Via } from '../core/model/features';
import type { LayerId } from '../core/model/project';
import { formatLength } from '../core/view/units';
import { rememberDefaults, type ToolSettings } from './settings';
import { snapToGrid } from './snap';
import { addFeature } from '../core/commands/features';
import {
  HIT_RADIUS_PX,
  NO_OVERLAY,
  handle,
  stateOnly,
  type Tool,
  type ToolContext,
  type ToolResult,
} from './tool';
import { drawnViaSize, type ViaSize } from './viaSize';

/** A press and release within this many screen pixels is a click, not a drag (SPEC F7). */
export const CLICK_PX = 3;

/** A press in progress: the via's centre is the grid-snapped press point. */
export interface ViaDrag {
  readonly press: Vec2;
  readonly centre: Vec2;
  readonly pointer: Vec2;
  /** Whether the pointer has left the click distance since the press. */
  readonly moved: boolean;
  /** The click distance in mm at the zoom of the press. */
  readonly clickMm: number;
  /** A layer switch during the drag drops it. */
  readonly layerId: LayerId;
}

export interface ViaState {
  readonly cursor: Vec2 | null;
  readonly drag: ViaDrag | null;
  /** Set by Shift+V: the next via is drawn to size even when a size is known. */
  readonly armed: boolean;
}

const IDLE: ViaState = { cursor: null, drag: null, armed: false };

/** Whether a click places nothing and the next via must be drawn (no size known yet, or Shift+V). */
export const isArmed = (state: ViaState, settings: ToolSettings): boolean =>
  state.armed || !settings.viaSizeKnown;

const viaAt = (id: string, at: Vec2, size: ViaSize): Via => ({ kind: 'via', id, at, ...size });

/** The drag, or `null` when the active layer changed since the press. */
const liveDrag = (drag: ViaDrag | null, ctx: ToolContext): ViaDrag | null =>
  drag !== null && drag.layerId === ctx.activeLayerId ? drag : null;

/** The size the drag would draw, or `null` while it is still a click. */
const draggedSize = (drag: ViaDrag, settings: ToolSettings): ViaSize | null =>
  drag.moved ? drawnViaSize(settings.via, distance(drag.centre, drag.pointer)) : null;

interface Placement {
  readonly state: ViaState;
  readonly at: Vec2;
  /** The drawn size, or `null` for a click at the current size. */
  readonly drawn: ViaSize | null;
}

/** Places a via; a drawn one also becomes the via default. */
function place({ state, at, drawn }: Placement, ctx: ToolContext): ToolResult<ViaState> {
  const via = viaAt(ctx.newId(), at, drawn ?? ctx.settings.via);
  const result: ToolResult<ViaState> = {
    state: { ...state, drag: null, armed: false },
    commands: [addFeature(via)],
    selection: [via.id],
    activateLayer: null,
  };
  return drawn === null ? result : { ...result, settings: rememberDefaults(ctx.settings, via) };
}

function release(state: ViaState, board: Vec2, ctx: ToolContext): ToolResult<ViaState> {
  const drag = liveDrag(state.drag, ctx);
  if (drag === null) {
    return stateOnly({ ...state, drag: null });
  }
  const drawn = draggedSize({ ...drag, pointer: board }, ctx.settings);
  if (drawn === null && isArmed(state, ctx.settings)) {
    return stateOnly({ ...state, drag: null });
  }
  return place({ state, at: drag.centre, drawn }, ctx);
}

function follow(drag: ViaDrag | null, board: Vec2, ctx: ToolContext): ViaDrag | null {
  const live = liveDrag(drag, ctx);
  if (live === null) {
    return null;
  }
  const moved = live.moved || distance(live.press, board) > live.clickMm;
  return { ...live, pointer: board, moved };
}

/** Esc drops a drag; with no drag it disarms, if a size is known to fall back to. */
function cancel(state: ViaState, settings: ToolSettings): ViaState {
  if (state.drag !== null) {
    return { ...state, cursor: null, drag: null };
  }
  return { ...state, cursor: null, armed: state.armed && !settings.viaSizeKnown };
}

const step = handle<ViaState>({
  pointermove: (s, e, ctx) =>
    stateOnly({
      ...s,
      cursor: snapToGrid(e.board, ctx.settings.grid),
      drag: follow(s.drag, e.board, ctx),
    }),
  pointerdown: (s, e, ctx) =>
    stateOnly({
      ...s,
      drag: {
        press: e.board,
        centre: snapToGrid(e.board, ctx.settings.grid),
        pointer: e.board,
        moved: false,
        clickMm: (CLICK_PX * e.hitRadiusMm) / HIT_RADIUS_PX,
        layerId: ctx.activeLayerId,
      },
    }),
  pointerup: (s, e, ctx) => release(s, e.board, ctx),
  key: (s, e) => stateOnly(e.key === 'Shift+v' ? { ...s, drag: null, armed: true } : s),
  cancel: (s, _e, ctx) => stateOnly(cancel(s, ctx.settings)),
});

/** The via being drawn, or the one a click would place, for the overlay. */
function ghost(state: ViaState, ctx: ToolContext): Via | null {
  const drag = liveDrag(state.drag, ctx);
  const size = drag === null ? null : draggedSize(drag, ctx.settings);
  if (drag !== null && size !== null) {
    return viaAt('ghost', drag.centre, size);
  }
  const at = drag?.centre ?? state.cursor;
  return at === null || isArmed(state, ctx.settings) ? null : viaAt('ghost', at, ctx.settings.via);
}

function hint(state: ViaState, ctx: ToolContext): string {
  const drawn = ghost(state, ctx);
  if (drawn !== null && state.drag?.moved === true) {
    const diameter = `${formatLength(drawn.padMm, ctx.units)} ${ctx.units}`;
    return `Via diameter ${diameter}. Release to place it; Esc cancels.`;
  }
  if (isArmed(state, ctx.settings)) {
    return 'Drag from the centre of a via to its edge to set the via size.';
  }
  return 'Click to place a via (on both layers); drag from its centre to draw one to size (Shift+V).';
}

/** Via tool (SPEC F7): click to place at the current size, or drag from the centre to size it. */
export const viaTool: Tool<ViaState> = {
  label: 'Via',
  shortcut: 'v',
  group: 'connections',
  cursor: 'crosshair',
  initial: IDLE,
  step,
  hint,
  preview: (_state, project) => project,
  overlay: (state, ctx) => ({ ...NO_OVERLAY, ghost: ghost(state, ctx) }),
};
