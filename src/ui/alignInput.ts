import type { Vec2 } from '../core/geometry/vec2';
import { screenToBoard } from '../core/geometry/viewport';
import type { AlignEvent } from '../tools/align';
import type { NavigationEvent } from '../tools/navigation';
import type { EditorStore } from './store';

/** How close (screen pixels) a click must be to grab an existing point. */
export const HIT_RADIUS_PX = 10;
const LEFT_BUTTON = 0;

type Mapper = (
  event: NavigationEvent,
  toBoard: (p: Vec2) => Vec2,
  zoom: number,
) => AlignEvent | null;

const mappers: Partial<Record<NavigationEvent['type'], Mapper>> = {
  pointerdown: (e, toBoard, zoom) =>
    e.type === 'pointerdown' && e.button === LEFT_BUTTON
      ? { type: 'pointerdown', board: toBoard(e.point), hitRadiusMm: HIT_RADIUS_PX / zoom }
      : null,
  pointermove: (e, toBoard) =>
    e.type === 'pointermove' ? { type: 'pointermove', board: toBoard(e.point) } : null,
  pointerup: () => ({ type: 'pointerup' }),
};

/**
 * Passes a pointer event that navigation did not use on to the align tool, converted to board
 * coordinates. Returns whether align mode took it.
 */
export function forwardToAlign(store: EditorStore, event: NavigationEvent): boolean {
  const { align, view } = store.getState();
  const mapper = mappers[event.type];
  const mapped =
    align === null || mapper === undefined
      ? null
      : mapper(event, (p) => screenToBoard(view.viewport, p), view.viewport.zoom);
  if (mapped === null) {
    return false;
  }
  store.getState().sendAlign(mapped);
  return true;
}
