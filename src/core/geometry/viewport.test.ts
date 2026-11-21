import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { closeTo, point, viewport } from './arbitraries.test-support';
import { apply } from './mat3';
import { rectCorners, type Rect } from './rect';
import {
  MAX_ZOOM,
  MIN_ZOOM,
  boardToScreen,
  clampZoom,
  fitToRect,
  panBy,
  screenToBoard,
  viewportMatrix,
  zoomAt,
} from './viewport';

const zoomFactor = fc.double({ min: 0.01, max: 100, noNaN: true });

describe('viewport', () => {
  it('screenToBoard inverts boardToScreen', () => {
    fc.assert(
      fc.property(viewport, point, (v, p) =>
        closeTo(screenToBoard(v, boardToScreen(v, p)), p, 1e-6),
      ),
    );
  });

  it('viewportMatrix matches boardToScreen', () => {
    fc.assert(
      fc.property(viewport, point, (v, p) =>
        closeTo(apply(viewportMatrix(v), p), boardToScreen(v, p), 1e-6),
      ),
    );
  });

  it('zoomAt keeps the board point under the anchor fixed', () => {
    fc.assert(
      fc.property(viewport, point, zoomFactor, (v, anchor, factor) => {
        const before = screenToBoard(v, anchor);
        const after = screenToBoard(zoomAt(v, anchor, factor), anchor);
        return closeTo(before, after, 1e-6 * Math.max(1, Math.abs(before.x), Math.abs(before.y)));
      }),
    );
  });

  it('zoomAt never leaves the zoom limits', () => {
    fc.assert(
      fc.property(viewport, point, zoomFactor, (v, anchor, factor) => {
        const { zoom } = zoomAt(v, anchor, factor);
        return zoom >= MIN_ZOOM && zoom <= MAX_ZOOM;
      }),
    );
  });

  it('clampZoom limits both ends', () => {
    expect(clampZoom(0)).toBe(MIN_ZOOM);
    expect(clampZoom(1e9)).toBe(MAX_ZOOM);
    expect(clampZoom(3)).toBe(3);
  });

  it('panBy moves every board point by the screen delta', () => {
    fc.assert(
      fc.property(viewport, point, point, (v, p, delta) => {
        const moved = boardToScreen(panBy(v, delta), p);
        const original = boardToScreen(v, p);
        return closeTo(moved, { x: original.x + delta.x, y: original.y + delta.y }, 1e-6);
      }),
    );
  });

  it('fitToRect puts the whole rectangle on screen', () => {
    const rect: Rect = { minX: -20, minY: 10, maxX: 80, maxY: 60 };
    const screen = { width: 800, height: 600 };
    const fitted = fitToRect(rect, screen);
    for (const corner of rectCorners(rect)) {
      const s = boardToScreen(fitted, corner);
      expect(s.x).toBeGreaterThanOrEqual(0);
      expect(s.x).toBeLessThanOrEqual(screen.width);
      expect(s.y).toBeGreaterThanOrEqual(0);
      expect(s.y).toBeLessThanOrEqual(screen.height);
    }
    expect(boardToScreen(fitted, { x: 30, y: 35 })).toEqual({ x: 400, y: 300 });
  });

  it('fitToRect handles degenerate rectangles without dividing by zero', () => {
    const fitted = fitToRect({ minX: 5, minY: 5, maxX: 5, maxY: 5 }, { width: 100, height: 100 });
    expect(fitted.zoom).toBe(MAX_ZOOM);
    expect(Number.isFinite(fitted.offset.x)).toBe(true);
  });
});
