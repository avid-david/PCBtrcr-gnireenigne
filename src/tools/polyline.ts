import { addFeature } from '../core/commands/features';
import { distance } from '../core/geometry/distance';
import type { Vec2 } from '../core/geometry/vec2';
import type { Feature } from '../core/model/features';
import type { LayerId } from '../core/model/project';
import { make, placeHandlers, type PlaceState } from './place';
import { snapToGrid } from './snap';
import {
  NO_OVERLAY,
  handle,
  stateOnly,
  type Tool,
  type ToolContext,
  type ToolHandlers,
  type ToolOverlay,
  type ToolResult,
} from './tool';

/** A plane outline or silkscreen line being drawn; points snap to the grid, not to anchors. */
export interface PolylineState extends PlaceState {
  readonly layerId: LayerId | null;
  readonly points: readonly Vec2[];
}

const IDLE: PolylineState = { layerId: null, points: [], cursor: null };

export interface PolylineInfo {
  /** Fewest points that make a feature (3 for a plane, 2 for a line). */
  readonly minPoints: number;
  /** Whether the shape closes back to its first point (drawn so while it is being drawn). */
  readonly closed: boolean;
  readonly build: (points: readonly Vec2[], layerId: LayerId, ctx: ToolContext) => Feature;
  readonly widthMm: (ctx: ToolContext) => number;
}

function finish(info: PolylineInfo, s: PolylineState, ctx: ToolContext): ToolResult<PolylineState> {
  if (s.layerId === null || s.points.length < info.minPoints) {
    return stateOnly({ ...IDLE, cursor: s.cursor });
  }
  const feature = info.build(s.points, s.layerId, ctx);
  return {
    state: IDLE,
    commands: [addFeature(feature)],
    selection: [feature.id],
    activateLayer: null,
  };
}

function addPoint(s: PolylineState, at: Vec2, ctx: ToolContext): PolylineState {
  const last = s.points.at(-1);
  return last !== undefined && distance(last, at) < 1e-9
    ? s
    : { layerId: s.layerId ?? ctx.activeLayerId, points: [...s.points, at], cursor: at };
}

/** Click to add points; double-click or Enter finishes; Backspace removes the last; Esc cancels. */
export function polylineHandlers(info: PolylineInfo): ToolHandlers<PolylineState> {
  const keys: Readonly<
    Record<string, (s: PolylineState, ctx: ToolContext) => ToolResult<PolylineState>>
  > = {
    Enter: (s, ctx) => finish(info, s, ctx),
    Backspace: (s) =>
      stateOnly(
        s.points.length <= 1
          ? { ...IDLE, cursor: s.cursor }
          : { ...s, points: s.points.slice(0, -1) },
      ),
  };
  return {
    pointerdown: (s, e, ctx) => stateOnly(addPoint(s, snapToGrid(e.board, ctx.settings.grid), ctx)),
    pointermove: (s, e, ctx) => stateOnly({ ...s, cursor: snapToGrid(e.board, ctx.settings.grid) }),
    doubleclick: (s, _e, ctx) => finish(info, s, ctx),
    key: (s, e, ctx) => keys[e.key]?.(s, ctx) ?? stateOnly(s),
    cancel: () => stateOnly(IDLE),
  };
}

/** The rubber band of the shape so far, closed back to the start for a closed shape. */
export function polylineOverlay(
  info: PolylineInfo,
  s: PolylineState,
  ctx: ToolContext,
): ToolOverlay {
  if (s.points.length === 0) {
    return NO_OVERLAY;
  }
  const open = [...s.points, ...(s.cursor === null ? [] : [s.cursor])];
  const first = s.points[0];
  const points = info.closed && open.length >= 3 && first !== undefined ? [...open, first] : open;
  return { ...NO_OVERLAY, rubberBand: { points, widthMm: info.widthMm(ctx) } };
}

const planeInfo: PolylineInfo = {
  minPoints: 3,
  closed: true,
  build: (points, layerId, ctx) => ({
    kind: 'plane',
    id: ctx.newId(),
    layerId,
    outline: points,
    attached: [],
  }),
  widthMm: () => 0.1,
};

/** Plane tool (SPEC F3): draw a copper pour outline on the active layer. */
export const planeTool: Tool<PolylineState> = {
  label: 'Plane',
  shortcut: 'l',
  group: 'connections',
  cursor: 'crosshair',
  initial: IDLE,
  step: handle(polylineHandlers(planeInfo)),
  hint: (s) =>
    s.points.length < 3
      ? 'Click the corners of a copper pour on the active layer (at least 3).'
      : 'Click to add corners. Double-click or Enter finishes, Backspace removes the last, Esc cancels.',
  preview: (_s, project) => project,
  overlay: (s, ctx) => polylineOverlay(planeInfo, s, ctx),
};

const silkLineInfo: PolylineInfo = {
  minPoints: 2,
  closed: false,
  build: (points, layerId, ctx) => ({
    kind: 'silkLine',
    id: ctx.newId(),
    layerId,
    points,
    widthMm: ctx.settings.silk.widthMm,
  }),
  widthMm: (ctx) => ctx.settings.silk.widthMm,
};

const silkLineHandlers = polylineHandlers(silkLineInfo);
const placeSilkText = handle(placeHandlers({ kind: 'silkText' }));

/** Text mode only uses the cursor of the shared state. */
const silkTextStep: Tool<PolylineState>['step'] = (s, e, ctx) => {
  const result = placeSilkText(s, e, ctx);
  return { ...result, state: { ...s, ...result.state } };
};

const silkTextGhost = (s: PolylineState, ctx: ToolContext): ToolOverlay => ({
  ...NO_OVERLAY,
  ghost:
    s.cursor === null
      ? null
      : make('silkText', {
          id: 'ghost',
          at: s.cursor,
          layerId: ctx.activeLayerId,
          settings: ctx.settings,
        }),
});

/** Silkscreen tool (SPEC F3): lines or text on the active layer's silkscreen, by mode. */
export const silkTool: Tool<PolylineState> = {
  label: 'Silkscreen',
  shortcut: 'k',
  group: 'annotations',
  cursor: 'crosshair',
  initial: IDLE,
  step: (s, e, ctx) =>
    ctx.settings.silk.mode === 'line'
      ? handle(silkLineHandlers)(s, e, ctx)
      : silkTextStep(s, e, ctx),
  hint: (_s, ctx) =>
    ctx.settings.silk.mode === 'line'
      ? 'Click to draw a silkscreen line; double-click or Enter finishes. Switch to Text in the side panel.'
      : 'Click to place silkscreen text. Edit its text in the side panel.',
  preview: (_s, project) => project,
  overlay: (s, ctx) =>
    ctx.settings.silk.mode === 'line'
      ? polylineOverlay(silkLineInfo, s, ctx)
      : silkTextGhost(s, ctx),
};
