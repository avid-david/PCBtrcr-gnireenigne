import type { Vec2 } from '../core/geometry/vec2';
import { panBy, zoomAt, type Viewport } from '../core/geometry/viewport';

/**
 * Pan/zoom gestures as a small state machine (SPEC F1): middle-mouse drag or space + left drag
 * pans, the wheel zooms around the cursor. Navigation works under every editing tool, so it is
 * not a `Tool` itself. Inputs are plain data so it is testable without a DOM.
 */
export type NavigationState =
  | { readonly kind: 'idle'; readonly spaceHeld: boolean }
  | { readonly kind: 'panning'; readonly spaceHeld: boolean; readonly last: Vec2 };

export type NavigationEvent =
  | { readonly type: 'pointerdown'; readonly button: number; readonly point: Vec2 }
  | { readonly type: 'pointermove'; readonly point: Vec2 }
  | { readonly type: 'pointerup' }
  | { readonly type: 'wheel'; readonly point: Vec2; readonly deltaPx: number }
  | { readonly type: 'spacedown' }
  | { readonly type: 'spaceup' };

export interface NavigationResult {
  readonly state: NavigationState;
  readonly viewport: Viewport;
  /** True when navigation consumed the event, so other tools should ignore it. */
  readonly handled: boolean;
}

export const INITIAL_NAVIGATION: NavigationState = { kind: 'idle', spaceHeld: false };

const LEFT_BUTTON = 0;
const MIDDLE_BUTTON = 1;
/** Zoom factor per wheel pixel; one typical notch (100 px) zooms by about 16 %. */
const ZOOM_PER_WHEEL_PX = 0.0015;

type Handler<E extends NavigationEvent> = (
  state: NavigationState,
  viewport: Viewport,
  event: E,
) => NavigationResult;

const unhandled = (state: NavigationState, viewport: Viewport): NavigationResult => ({
  state,
  viewport,
  handled: false,
});

const startsPan = (state: NavigationState, button: number): boolean =>
  button === MIDDLE_BUTTON || (button === LEFT_BUTTON && state.spaceHeld);

const onPointerDown: Handler<Extract<NavigationEvent, { type: 'pointerdown' }>> = (s, v, e) =>
  startsPan(s, e.button)
    ? {
        state: { kind: 'panning', spaceHeld: s.spaceHeld, last: e.point },
        viewport: v,
        handled: true,
      }
    : unhandled(s, v);

const onPointerMove: Handler<Extract<NavigationEvent, { type: 'pointermove' }>> = (s, v, e) => {
  if (s.kind !== 'panning') {
    return unhandled(s, v);
  }
  const delta = { x: e.point.x - s.last.x, y: e.point.y - s.last.y };
  return { state: { ...s, last: e.point }, viewport: panBy(v, delta), handled: true };
};

const onPointerUp: Handler<Extract<NavigationEvent, { type: 'pointerup' }>> = (s, v) =>
  s.kind === 'panning'
    ? { state: { kind: 'idle', spaceHeld: s.spaceHeld }, viewport: v, handled: true }
    : unhandled(s, v);

const onWheel: Handler<Extract<NavigationEvent, { type: 'wheel' }>> = (s, v, e) => ({
  state: s,
  viewport: zoomAt(v, e.point, Math.exp(-e.deltaPx * ZOOM_PER_WHEEL_PX)),
  handled: true,
});

const onSpace =
  (held: boolean): Handler<NavigationEvent> =>
  (s, v) => ({ state: { ...s, spaceHeld: held }, viewport: v, handled: true });

const handlers: {
  readonly [T in NavigationEvent['type']]: Handler<Extract<NavigationEvent, { type: T }>>;
} = {
  pointerdown: onPointerDown,
  pointermove: onPointerMove,
  pointerup: onPointerUp,
  wheel: onWheel,
  spacedown: onSpace(true),
  spaceup: onSpace(false),
};

/** Advances the navigation state machine by one input event. */
export function navigate(
  state: NavigationState,
  viewport: Viewport,
  event: NavigationEvent,
): NavigationResult {
  const handler = handlers[event.type] as Handler<NavigationEvent>;
  return handler(state, viewport, event);
}
