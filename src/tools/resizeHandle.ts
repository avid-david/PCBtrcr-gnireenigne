import type { Command } from '../core/commands/command';
import { updateFeature } from '../core/commands/features';
import { isFeatureLocked } from '../core/connectivity/netStyles';
import { distance } from '../core/geometry/distance';
import type { Vec2 } from '../core/geometry/vec2';
import { featureOnLayer } from '../core/model/featureKinds';
import type { ConnectionPoint, Feature, FeatureId, Hole, Via } from '../core/model/features';
import type { LayerId, Project } from '../core/model/project';
import { formatLength } from '../core/view/units';
import { rememberDefaults, type ToolSettings } from './settings';
import { HIT_RADIUS_PX, type ToolContext } from './tool';
import { CLICK_PX } from './via';
import { clampDiameter, drawnViaSize } from './viaSize';

/** The handle shows only while the feature is at least this big on screen (SPEC F7). */
export const HANDLE_MIN_RADIUS_PX = 8;
/** A press this close to the handle grabs it; below `HANDLE_MIN_RADIUS_PX`, so the centre never does. */
export const HANDLE_HIT_PX = 5;
/** Drawn radius of the handle dot. */
export const HANDLE_DRAW_PX = 4;

type HandleContext = Pick<ToolContext, 'project' | 'activeLayerId' | 'selection'>;

/**
 * Inactive-layer features are not editable; features on every layer always are (SPEC). Features
 * of a locked net cannot be selected at all, so they cannot be moved or deleted (docs/adr/0008).
 */
export const editable = (f: Feature, ctx: Pick<ToolContext, 'project' | 'activeLayerId'>) =>
  featureOnLayer(f, ctx.activeLayerId) && !isFeatureLocked(ctx.project, f);

/** Features with a resize handle: round, sized by one diameter. */
export type Resizable = Via | Hole | ConnectionPoint;

interface ResizeKind<F extends Resizable> {
  radiusMm(f: F): number;
  /** The feature with a new radius, clamped like a drawn via (SPEC F7). */
  resized(f: F, radiusMm: number): F;
}

const RESIZE_KINDS: {
  readonly [K in Resizable['kind']]: ResizeKind<Extract<Resizable, { kind: K }>>;
} = {
  // A via keeps its own drill-to-pad ratio, the way a drawn via keeps the defaults' ratio.
  via: { radiusMm: (f) => f.padMm / 2, resized: (f, r) => ({ ...f, ...drawnViaSize(f, r) }) },
  hole: {
    radiusMm: (f) => f.diameterMm / 2,
    resized: (f, r) => ({ ...f, diameterMm: clampDiameter(2 * r) }),
  },
  point: {
    radiusMm: (f) => f.diameterMm / 2,
    resized: (f, r) => ({ ...f, diameterMm: clampDiameter(2 * r) }),
  },
};

export const isResizable = (f: Feature): f is Resizable => f.kind in RESIZE_KINDS;

const kindOf = (f: Resizable) => RESIZE_KINDS[f.kind] as ResizeKind<Resizable>;

/** Radius of a resizable feature in mm. */
export const radiusOf = (f: Resizable): number => kindOf(f).radiusMm(f);

/** The feature resized to `radiusMm` from its centre. */
export const resizedFeature = (f: Resizable, radiusMm: number): Resizable =>
  kindOf(f).resized(f, radiusMm);

export interface ResizeHandle {
  readonly id: FeatureId;
  readonly centre: Vec2;
  /** Where the handle is: on the feature's +x edge. */
  readonly at: Vec2;
}

/** The selected feature when exactly one is selected and it is resizable and editable. */
function soleResizable(ctx: HandleContext): Resizable | null {
  const [id, ...others] = ctx.selection;
  const f = others.length === 0 ? ctx.project.features.find((x) => x.id === id) : undefined;
  return f !== undefined && isResizable(f) && editable(f, ctx) ? f : null;
}

/**
 * The resize handle of the one selected via, hole or point, or `null` when there is none or the
 * feature's on-screen radius is below `minPx` (SPEC F7).
 */
export function resizeHandle(
  ctx: HandleContext,
  mmPerPx: number,
  minPx: number = HANDLE_MIN_RADIUS_PX,
): ResizeHandle | null {
  const f = soleResizable(ctx);
  const r = f === null ? 0 : radiusOf(f);
  if (f === null || r < minPx * mmPerPx) {
    return null;
  }
  return { id: f.id, centre: f.at, at: { x: f.at.x + r, y: f.at.y } };
}

/** Whether a press at `at` grabs the handle. */
export const hitsHandle = (handle: ResizeHandle, at: Vec2, mmPerPx: number): boolean =>
  distance(at, handle.at) <= HANDLE_HIT_PX * mmPerPx;

/** A resize handle being dragged (SPEC F7); `radiusMm` stays `null` until the pointer moves. */
export interface Resizing {
  readonly mode: 'resizing';
  readonly id: FeatureId;
  readonly centre: Vec2;
  readonly press: Vec2;
  /** The click distance in mm at the zoom of the press. */
  readonly clickMm: number;
  /** A layer switch during the drag drops it. */
  readonly layerId: LayerId;
  readonly radiusMm: number | null;
}

/** Screen pixels → mm at the current zoom, from the hit radius the UI sends (ADR 0009). */
const mmPerPxOf = (hitRadiusMm: number) => hitRadiusMm / HIT_RADIUS_PX;

/** Starts a resize when a press grabs the handle; the handle wins over features under it. */
export function grabHandle(ctx: ToolContext, at: Vec2, hitRadiusMm: number): Resizing | null {
  const mmPerPx = mmPerPxOf(hitRadiusMm);
  const h = resizeHandle(ctx, mmPerPx);
  if (h === null || !hitsHandle(h, at, mmPerPx)) {
    return null;
  }
  return {
    mode: 'resizing',
    id: h.id,
    centre: h.centre,
    press: at,
    clickMm: CLICK_PX * mmPerPx,
    layerId: ctx.activeLayerId,
    radiusMm: null,
  };
}

/** The feature being resized, while it still exists, is editable and its layer is active. */
function target(
  s: Resizing,
  ctx: Pick<ToolContext, 'project' | 'activeLayerId'>,
): Resizable | null {
  const f = ctx.project.features.find((x) => x.id === s.id);
  const live = f !== undefined && s.layerId === ctx.activeLayerId;
  return live && isResizable(f) && editable(f, ctx) ? f : null;
}

/** The drag after the pointer moved to `at`, or `null` when it is dropped. */
export function followHandle(s: Resizing, at: Vec2, ctx: ToolContext): Resizing | null {
  if (target(s, ctx) === null) {
    return null;
  }
  const moved = s.radiusMm !== null || distance(at, s.press) > s.clickMm;
  return { ...s, radiusMm: moved ? distance(s.centre, at) : null };
}

/** The edit a released drag makes and the defaults it sets, or `null` for no edit. */
export function releaseHandle(
  s: Resizing,
  ctx: ToolContext,
): { readonly command: Command; readonly settings: ToolSettings } | null {
  const f = target(s, ctx);
  if (f === null || s.radiusMm === null) {
    return null;
  }
  const resized = resizedFeature(f, s.radiusMm);
  return { command: updateFeature(resized), settings: rememberDefaults(ctx.settings, resized) };
}

/** The feature at the size the drag would give it, or as it is before the pointer moves. */
function resizing(s: Resizing, project: Project): Resizable | null {
  const f = project.features.find((x) => x.id === s.id);
  if (f === undefined || !isResizable(f)) {
    return null;
  }
  return s.radiusMm === null ? f : resizedFeature(f, s.radiusMm);
}

/** The project with the live size, for the preview; unchanged until the pointer moves. */
export function resizePreview(s: Resizing, project: Project): Project {
  const f = s.radiusMm === null ? null : resizing(s, project);
  return f === null ? project : updateFeature(f).execute(project);
}

/** Hint while dragging a handle: the diameter in display units. */
export function resizeHint(s: Resizing, ctx: ToolContext): string {
  const f = resizing(s, ctx.project);
  const size =
    f === null ? '' : `Diameter ${formatLength(2 * radiusOf(f), ctx.units)} ${ctx.units}. `;
  return `${size}Release to resize; Esc cancels.`;
}

/**
 * Where the Select tool draws its handle (board mm), or `null` for none. While a handle is being
 * dragged it stays visible however small the feature gets.
 */
export function handlePosition(
  state: { readonly mode: string },
  ctx: HandleContext,
  mmPerPx: number,
): Vec2 | null {
  const minPx = state.mode === 'resizing' ? 0 : HANDLE_MIN_RADIUS_PX;
  return resizeHandle(ctx, mmPerPx, minPx)?.at ?? null;
}
