import { addFeature } from '../core/commands/features';
import { distance } from '../core/geometry/distance';
import type { Vec2 } from '../core/geometry/vec2';
import type { Trace, TraceVertex } from '../core/model/features';
import type { LayerId } from '../core/model/project';
import { snapPoint, type Snap } from './snap';
import {
  NO_OVERLAY,
  handle,
  stateOnly,
  type Tool,
  type ToolContext,
  type ToolHandlers,
  type ToolResult,
} from './tool';

/** A trace being drawn: points so far (with the layer they are on) and where the cursor is. */
export interface TraceState {
  readonly layerId: LayerId | null;
  readonly points: readonly Snap[];
  readonly cursor: Snap | null;
}

const IDLE: TraceState = { layerId: null, points: [], cursor: null };

const sameSpot = (a: Snap, b: Snap): boolean =>
  a.anchor !== null ? a.anchor === b.anchor : b.anchor === null && distance(a.at, b.at) < 1e-9;

const snapFor = (state: TraceState, ctx: ToolContext, e: { board: Vec2; hitRadiusMm: number }) =>
  snapPoint(e.board, {
    project: ctx.project,
    layerId: state.layerId ?? ctx.activeLayerId,
    radiusMm: e.hitRadiusMm,
    grid: ctx.settings.grid,
  });

function vertexOf(point: Snap, ctx: ToolContext): TraceVertex {
  const id = ctx.newId();
  return point.anchor === null
    ? { id, kind: 'free', at: point.at }
    : { id, kind: 'bound', anchor: point.anchor };
}

/** Commits the trace as one undo step (if it has two distinct points) and starts over. */
function finish(state: TraceState, ctx: ToolContext): ToolResult<TraceState> {
  const layerId = state.layerId;
  if (layerId === null || state.points.length < 2) {
    return stateOnly(IDLE);
  }
  const trace: Trace = {
    kind: 'trace',
    id: ctx.newId(),
    layerId,
    widthMm: ctx.settings.trace.widthMm,
    vertices: state.points.map((p) => vertexOf(p, ctx)),
  };
  return { state: IDLE, commands: [addFeature(trace)], selection: null, activateLayer: null };
}

function addPoint(state: TraceState, point: Snap, ctx: ToolContext): TraceState {
  const last = state.points.at(-1);
  if (last !== undefined && sameSpot(last, point)) {
    return state;
  }
  return {
    layerId: state.layerId ?? ctx.activeLayerId,
    points: [...state.points, point],
    cursor: point,
  };
}

const keys: Readonly<Record<string, (s: TraceState, ctx: ToolContext) => ToolResult<TraceState>>> =
  {
    Enter: finish,
    Backspace: (s) =>
      stateOnly(
        s.points.length <= 1
          ? { ...IDLE, cursor: s.cursor }
          : { ...s, points: s.points.slice(0, -1) },
      ),
  };

const handlers: ToolHandlers<TraceState> = {
  pointerdown: (s, e, ctx) => stateOnly(addPoint(s, snapFor(s, ctx, e), ctx)),
  pointermove: (s, e, ctx) => stateOnly({ ...s, cursor: snapFor(s, ctx, e) }),
  doubleclick: (s, _e, ctx) => finish(s, ctx),
  key: (s, e, ctx) => keys[e.key]?.(s, ctx) ?? stateOnly(s),
  cancel: () => stateOnly(IDLE),
};

/** Trace tool (SPEC F3): click to add vertices, double-click or Enter to finish; snaps to anchors. */
export const traceTool: Tool<TraceState> = {
  label: 'Trace',
  shortcut: 't',
  cursor: 'crosshair',
  initial: IDLE,
  step: handle(handlers),
  hint: (state) =>
    state.points.length === 0
      ? 'Click to start a trace; it snaps to pads, vias and trace points.'
      : 'Click to add points. Double-click or Enter finishes, Backspace removes the last point, Esc cancels.',
  preview: (_state, project) => project,
  overlay: (state, ctx) => {
    const cursor = state.cursor;
    const points = [...state.points, ...(cursor === null ? [] : [cursor])].map((p) => p.at);
    return {
      ...NO_OVERLAY,
      rubberBand:
        state.points.length === 0 ? null : { points, widthMm: ctx.settings.trace.widthMm },
      snapTarget: cursor?.anchor === null || cursor === null ? null : cursor.at,
    };
  },
};
