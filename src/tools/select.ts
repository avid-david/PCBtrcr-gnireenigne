import { moveFeatures, removeFeatures } from '../core/commands/features';
import { distance, rectBetween } from '../core/geometry/distance';
import { sub, type Vec2 } from '../core/geometry/vec2';
import { featureBounds, featureDistance, featureOnLayer } from '../core/model/featureKinds';
import type { Feature, FeatureId } from '../core/model/features';
import type { Project } from '../core/model/project';
import { snapToGrid } from './snap';
import {
  NO_OVERLAY,
  handle,
  stateOnly,
  type Tool,
  type ToolContext,
  type ToolHandlers,
  type ToolResult,
} from './tool';

/** Select tool: idle, pressed on a feature (may become a move), moving, or dragging a box. */
export type SelectState =
  | { readonly mode: 'idle' }
  | { readonly mode: 'pressing'; readonly start: Vec2; readonly ids: readonly FeatureId[] }
  | {
      readonly mode: 'moving';
      readonly start: Vec2;
      readonly ids: readonly FeatureId[];
      readonly delta: Vec2;
    }
  | {
      readonly mode: 'boxing';
      readonly start: Vec2;
      readonly current: Vec2;
      readonly additive: boolean;
    };

const IDLE: SelectState = { mode: 'idle' };

/** Inactive-layer features are not editable; features on every layer always are (SPEC). */
const editable = (f: Feature, ctx: ToolContext): boolean => featureOnLayer(f, ctx.activeLayerId);

/** The topmost editable feature within the radius (later features are drawn on top). */
function hitFeature(ctx: ToolContext, at: Vec2, radiusMm: number): Feature | null {
  const hits = ctx.project.features.filter(
    (f) => editable(f, ctx) && featureDistance(f, at, ctx.project) <= radiusMm,
  );
  return hits.at(-1) ?? null;
}

const toggle = (ids: readonly FeatureId[], id: FeatureId): FeatureId[] =>
  ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];

const select = (state: SelectState, selection: readonly FeatureId[]): ToolResult<SelectState> => ({
  ...stateOnly(state),
  selection,
});

function onPointerDown(ctx: ToolContext, at: Vec2, e: { hitRadiusMm: number; shift: boolean }) {
  const hit = hitFeature(ctx, at, e.hitRadiusMm);
  if (hit === null) {
    return stateOnly<SelectState>({ mode: 'boxing', start: at, current: at, additive: e.shift });
  }
  const selection = e.shift
    ? toggle(ctx.selection, hit.id)
    : ctx.selection.includes(hit.id)
      ? ctx.selection
      : [hit.id];
  const next: SelectState = selection.includes(hit.id)
    ? { mode: 'pressing', start: at, ids: selection }
    : IDLE;
  return select(next, selection);
}

function onPointerMove(s: SelectState, e: { board: Vec2; hitRadiusMm: number }, ctx: ToolContext) {
  const at = e.board;
  const radiusMm = e.hitRadiusMm;
  if (s.mode === 'boxing') {
    return stateOnly<SelectState>({ ...s, current: at });
  }
  const dragging =
    s.mode === 'moving' || (s.mode === 'pressing' && distance(at, s.start) > radiusMm);
  if (s.mode === 'idle' || !dragging) {
    return stateOnly(s);
  }
  const delta = snapToGrid(sub(at, s.start), ctx.settings.grid);
  return stateOnly<SelectState>({ mode: 'moving', start: s.start, ids: s.ids, delta });
}

/** Features inside the box (entirely), editable on the active layer. */
function boxed(ctx: ToolContext, s: Extract<SelectState, { mode: 'boxing' }>): FeatureId[] {
  const box = rectBetween(s.start, s.current);
  return ctx.project.features
    .filter((f) => editable(f, ctx))
    .filter((f) => {
      const b = featureBounds(f, ctx.project);
      return b.minX >= box.minX && b.maxX <= box.maxX && b.minY >= box.minY && b.maxY <= box.maxY;
    })
    .map((f) => f.id);
}

function onPointerUp(s: SelectState, ctx: ToolContext): ToolResult<SelectState> {
  if (s.mode === 'moving') {
    return { ...stateOnly<SelectState>(IDLE), commands: [moveFeatures(s.ids, s.delta)] };
  }
  if (s.mode === 'boxing') {
    const inside = boxed(ctx, s);
    return select(IDLE, s.additive ? [...new Set([...ctx.selection, ...inside])] : inside);
  }
  return stateOnly(IDLE);
}

const handlers: ToolHandlers<SelectState> = {
  pointerdown: (_s, e, ctx) => onPointerDown(ctx, e.board, e),
  pointermove: (s, e, ctx) => onPointerMove(s, e, ctx),
  pointerup: (s, _e, ctx) => onPointerUp(s, ctx),
  key: (s, e, ctx) =>
    (e.key === 'Delete' || e.key === 'Backspace') && ctx.selection.length > 0
      ? {
          state: IDLE,
          commands: [removeFeatures(ctx.selection)],
          selection: [],
          activateLayer: null,
        }
      : stateOnly(s),
  cancel: () => stateOnly(IDLE),
};

/** Select/move tool (SPEC F3): click, Shift-click, box-select, drag to move, Delete. */
export const selectTool: Tool<SelectState> = {
  label: 'Select',
  shortcut: 's',
  cursor: 'default',
  initial: IDLE,
  step: handle(handlers),
  hint: () =>
    'Click to select (Shift adds), drag to move, drag on empty board to box-select, Delete removes.',
  preview: (state: SelectState, project: Project) =>
    state.mode === 'moving' ? moveFeatures(state.ids, state.delta).execute(project) : project,
  overlay: (state) => ({
    ...NO_OVERLAY,
    box: state.mode === 'boxing' ? rectBetween(state.start, state.current) : null,
  }),
};
