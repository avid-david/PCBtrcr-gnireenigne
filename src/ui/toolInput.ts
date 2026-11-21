import type { Vec2 } from '../core/geometry/vec2';
import { screenToBoard } from '../core/geometry/viewport';
import type { NavigationEvent } from '../tools/navigation';
import type { ToolEvent } from '../tools/tool';
import type { EditorStore } from './store';

/** How close (screen pixels) a click must be to hit or snap to something. */
export const HIT_RADIUS_PX = 10;
const LEFT_BUTTON = 0;

interface Conversion {
  readonly toBoard: (p: Vec2) => Vec2;
  readonly hitRadiusMm: number;
  readonly shift: boolean;
}

type Mapper = (event: NavigationEvent, c: Conversion) => ToolEvent | null;

const mappers: Partial<Record<NavigationEvent['type'], Mapper>> = {
  pointerdown: (e, c) =>
    e.type === 'pointerdown' && e.button === LEFT_BUTTON
      ? {
          type: 'pointerdown',
          board: c.toBoard(e.point),
          hitRadiusMm: c.hitRadiusMm,
          shift: c.shift,
        }
      : null,
  pointermove: (e, c) =>
    e.type === 'pointermove'
      ? { type: 'pointermove', board: c.toBoard(e.point), hitRadiusMm: c.hitRadiusMm }
      : null,
  pointerup: (e, c) =>
    e.type === 'pointerup' && e.point !== undefined
      ? { type: 'pointerup', board: c.toBoard(e.point) }
      : null,
};

const conversion = (store: EditorStore, shift: boolean): Conversion => {
  const { viewport } = store.getState().view;
  return {
    toBoard: (p) => screenToBoard(viewport, p),
    hitRadiusMm: HIT_RADIUS_PX / viewport.zoom,
    shift,
  };
};

/**
 * Passes a pointer event that navigation did not use on to the active tool, converted to
 * board coordinates. Returns whether the tool took it.
 */
export function forwardToTool(store: EditorStore, event: NavigationEvent, shift = false): boolean {
  const mapped = mappers[event.type]?.(event, conversion(store, shift)) ?? null;
  if (mapped === null) {
    return false;
  }
  store.getState().sendTool(mapped);
  return true;
}

/** A double-click on the board (finishes a trace). */
export function forwardDoubleClick(store: EditorStore, point: Vec2): void {
  store
    .getState()
    .sendTool({ type: 'doubleclick', board: conversion(store, false).toBoard(point) });
}
