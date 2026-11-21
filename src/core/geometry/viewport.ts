import type { Mat3 } from './mat3';
import { rectCenter, rectHeight, rectWidth, type Rect } from './rect';
import { add, scale, sub, type Vec2 } from './vec2';

/**
 * Maps board space (mm) to screen space (CSS pixels): `screen = board · zoom + offset`.
 * `zoom` is screen pixels per millimetre.
 */
export interface Viewport {
  readonly zoom: number;
  readonly offset: Vec2;
}

export interface ScreenSize {
  readonly width: number;
  readonly height: number;
}

/** Zoom limits in screen pixels per millimetre. */
export const MIN_ZOOM = 0.05;
export const MAX_ZOOM = 200;

/** Fraction of the screen left empty around content after fit-to-view. */
const FIT_MARGIN = 0.05;

export const DEFAULT_VIEWPORT: Viewport = { zoom: 4, offset: { x: 0, y: 0 } };

/** Restricts a zoom value to the supported range. */
export const clampZoom = (zoom: number): number => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));

/** Board position → screen position. */
export const boardToScreen = (v: Viewport, p: Vec2): Vec2 => add(scale(p, v.zoom), v.offset);

/** Screen position → board position. */
export const screenToBoard = (v: Viewport, p: Vec2): Vec2 => scale(sub(p, v.offset), 1 / v.zoom);

/** Moves the view by a screen-space delta. */
export const panBy = (v: Viewport, delta: Vec2): Viewport => ({
  ...v,
  offset: add(v.offset, delta),
});

/** Multiplies the zoom by `factor`, keeping the board point under `anchor` (screen) fixed. */
export function zoomAt(v: Viewport, anchor: Vec2, factor: number): Viewport {
  const zoom = clampZoom(v.zoom * factor);
  const boardAnchor = screenToBoard(v, anchor);
  return { zoom, offset: sub(anchor, scale(boardAnchor, zoom)) };
}

/** Viewport that shows the whole rectangle centred on a screen of the given size. */
export function fitToRect(rect: Rect, screen: ScreenSize): Viewport {
  const usableW = screen.width * (1 - 2 * FIT_MARGIN);
  const usableH = screen.height * (1 - 2 * FIT_MARGIN);
  const w = Math.max(rectWidth(rect), Number.EPSILON);
  const h = Math.max(rectHeight(rect), Number.EPSILON);
  const zoom = clampZoom(Math.min(usableW / w, usableH / h));
  const screenCenter = { x: screen.width / 2, y: screen.height / 2 };
  return { zoom, offset: sub(screenCenter, scale(rectCenter(rect), zoom)) };
}

/** The viewport as a board → screen matrix. */
export const viewportMatrix = (v: Viewport): Mat3 => [
  v.zoom,
  0,
  v.offset.x,
  0,
  v.zoom,
  v.offset.y,
  0,
  0,
  1,
];
