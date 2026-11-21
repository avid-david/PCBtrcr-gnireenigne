import { boardToImage, imageToBoard } from '../core/alignment/alignment';
import { addMatch, placePoint, type Command } from '../core/commands/command';
import type { Vec2 } from '../core/geometry/vec2';
import { movePoint, pointsOnLayer, type PointRef } from '../core/model/points';
import { CORNERS, type Corner, type LayerId, type Project } from '../core/model/project';

/**
 * Align mode (SPEC F2) as a small state machine: place board corners, match features across
 * layers, drag existing points. Inputs are board positions; it never mutates the project but
 * returns commands, plus the layer to activate (matching hops between photos).
 */
export type AlignMode = 'corners' | 'matches';

export interface AlignState {
  readonly mode: AlignMode;
  /** First half of a match: clicked on one layer, waiting for the same feature on another. */
  readonly pending: { readonly layerId: LayerId; readonly px: Vec2 } | null;
  /** A point being dragged. `toImage` is frozen at drag start: the alignment changes while dragging. */
  readonly drag: {
    readonly ref: PointRef;
    readonly px: Vec2;
    readonly start: Vec2;
    readonly toImage: (board: Vec2) => Vec2 | null;
  } | null;
}

export type AlignEvent =
  | { readonly type: 'pointerdown'; readonly board: Vec2; readonly hitRadiusMm: number }
  | { readonly type: 'pointermove'; readonly board: Vec2 }
  | { readonly type: 'pointerup' }
  | { readonly type: 'cancel' }
  | { readonly type: 'setMode'; readonly mode: AlignMode };

export interface AlignContext {
  readonly project: Project;
  readonly activeLayerId: LayerId;
  readonly newId: () => string;
}

export interface AlignResult {
  readonly state: AlignState;
  readonly commands: readonly Command[];
  /** Layer to make active after this event, or `null` to keep the current one. */
  readonly activateLayer: LayerId | null;
}

export const INITIAL_ALIGN: AlignState = { mode: 'corners', pending: null, drag: null };

const result = (
  state: AlignState,
  commands: readonly Command[] = [],
  activateLayer: LayerId | null = null,
): AlignResult => ({
  state,
  commands,
  activateLayer,
});

/** The next corner still missing on a layer, in clicking order. */
export function nextCorner(project: Project, layerId: LayerId): Corner | null {
  const corners = project.layers.find((l) => l.id === layerId)?.corners ?? {};
  return CORNERS.find((c) => corners[c] === undefined) ?? null;
}

/** The existing point on the active layer under `board`, if any. */
function hitPoint(
  ctx: AlignContext,
  board: Vec2,
  radiusMm: number,
): { ref: PointRef; px: Vec2 } | null {
  const hits = pointsOnLayer(ctx.project, ctx.activeLayerId).flatMap((point) => {
    const at = imageToBoard(ctx.project, ctx.activeLayerId, point.px);
    const d = at === null ? Number.POSITIVE_INFINITY : Math.hypot(at.x - board.x, at.y - board.y);
    return d <= radiusMm ? [{ ...point, d }] : [];
  });
  const nearest = hits.sort((a, b) => a.d - b.d)[0];
  return nearest === undefined ? null : { ref: nearest.ref, px: nearest.px };
}

const otherLayer = (project: Project, layerId: LayerId): LayerId | null =>
  project.layers.find((l) => l.id !== layerId && l.image !== null)?.id ?? null;

function placeCorner(state: AlignState, ctx: AlignContext, px: Vec2): AlignResult {
  const corner = nextCorner(ctx.project, ctx.activeLayerId);
  if (corner === null) {
    return result(state);
  }
  const command = placePoint({ kind: 'corner', layerId: ctx.activeLayerId, corner }, px);
  const done = corner === CORNERS[CORNERS.length - 1];
  return result(done ? { ...state, mode: 'matches' } : state, [command]);
}

function placeMatchPoint(state: AlignState, ctx: AlignContext, px: Vec2): AlignResult {
  const pending = state.pending;
  if (pending === null || pending.layerId === ctx.activeLayerId) {
    const next = { ...state, pending: { layerId: ctx.activeLayerId, px } };
    return result(next, [], otherLayer(ctx.project, ctx.activeLayerId));
  }
  const match = addMatch({
    id: ctx.newId(),
    points: { [pending.layerId]: pending.px, [ctx.activeLayerId]: px },
  });
  return result({ ...state, pending: null }, [match], pending.layerId);
}

function onPointerDown(
  state: AlignState,
  ctx: AlignContext,
  e: Extract<AlignEvent, { type: 'pointerdown' }>,
): AlignResult {
  const hit = hitPoint(ctx, e.board, e.hitRadiusMm);
  if (hit !== null) {
    const toImage = (board: Vec2) => boardToImage(ctx.project, ctx.activeLayerId, board);
    return result({ ...state, drag: { ref: hit.ref, px: hit.px, start: hit.px, toImage } });
  }
  const px = boardToImage(ctx.project, ctx.activeLayerId, e.board);
  if (px === null) {
    return result(state);
  }
  return state.mode === 'corners' ? placeCorner(state, ctx, px) : placeMatchPoint(state, ctx, px);
}

function onPointerMove(
  state: AlignState,
  e: Extract<AlignEvent, { type: 'pointermove' }>,
): AlignResult {
  const px = state.drag?.toImage(e.board) ?? null;
  return state.drag === null || px === null
    ? result(state)
    : result({ ...state, drag: { ...state.drag, px } });
}

function onPointerUp(state: AlignState): AlignResult {
  const drag = state.drag;
  if (drag === null) {
    return result(state);
  }
  const moved = drag.px.x !== drag.start.x || drag.px.y !== drag.start.y;
  return result({ ...state, drag: null }, moved ? [placePoint(drag.ref, drag.px)] : []);
}

/** Advances align mode by one event. */
export function alignStep(state: AlignState, event: AlignEvent, ctx: AlignContext): AlignResult {
  const handlers: {
    readonly [T in AlignEvent['type']]: (e: Extract<AlignEvent, { type: T }>) => AlignResult;
  } = {
    pointerdown: (e) => onPointerDown(state, ctx, e),
    pointermove: (e) => onPointerMove(state, e),
    pointerup: () => onPointerUp(state),
    cancel: () => result({ ...state, pending: null, drag: null }),
    setMode: (e) => result({ ...state, mode: e.mode, pending: null }),
  };
  return (handlers[event.type] as (e: AlignEvent) => AlignResult)(event);
}

/** The project as it would be if the dragged point were dropped now (for live preview). */
export const previewProject = (project: Project, state: AlignState): Project =>
  state.drag === null ? project : movePoint(project, state.drag.ref, state.drag.px);
