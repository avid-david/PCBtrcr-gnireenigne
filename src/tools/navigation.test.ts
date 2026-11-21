import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { closeTo, point, viewport } from '../core/geometry/arbitraries.test-support';
import { screenToBoard, type Viewport } from '../core/geometry/viewport';
import {
  INITIAL_NAVIGATION,
  navigate,
  type NavigationEvent,
  type NavigationState,
} from './navigation';

const view: Viewport = { zoom: 2, offset: { x: 10, y: 20 } };

function run(events: NavigationEvent[], start: NavigationState = INITIAL_NAVIGATION) {
  return events.reduce((acc, e) => navigate(acc.state, acc.viewport, e), {
    state: start,
    viewport: view,
    handled: false,
  });
}

describe('navigation', () => {
  it('pans with a middle-button drag', () => {
    const result = run([
      { type: 'pointerdown', button: 1, point: { x: 100, y: 100 } },
      { type: 'pointermove', point: { x: 130, y: 90 } },
      { type: 'pointermove', point: { x: 140, y: 95 } },
      { type: 'pointerup' },
    ]);
    expect(result.viewport.offset).toEqual({ x: 50, y: 15 });
    expect(result.state.kind).toBe('idle');
  });

  it('pans with space held and a left drag', () => {
    const result = run([
      { type: 'spacedown' },
      { type: 'pointerdown', button: 0, point: { x: 0, y: 0 } },
      { type: 'pointermove', point: { x: 5, y: 5 } },
    ]);
    expect(result.viewport.offset).toEqual({ x: 15, y: 25 });
    expect(result.state).toEqual({ kind: 'panning', spaceHeld: true, last: { x: 5, y: 5 } });
  });

  it('leaves a plain left click and moves to the active tool', () => {
    const down = run([{ type: 'pointerdown', button: 0, point: { x: 0, y: 0 } }]);
    expect(down.handled).toBe(false);
    const move = run([{ type: 'pointermove', point: { x: 5, y: 5 } }]);
    expect(move.handled).toBe(false);
    expect(move.viewport).toBe(view);
    expect(run([{ type: 'pointerup' }]).handled).toBe(false);
  });

  it('remembers space across a pan and forgets it on release', () => {
    const result = run([
      { type: 'spacedown' },
      { type: 'pointerdown', button: 0, point: { x: 0, y: 0 } },
      { type: 'pointerup' },
      { type: 'spaceup' },
    ]);
    expect(result.state).toEqual({ kind: 'idle', spaceHeld: false });
  });

  it('wheel up zooms in and wheel down zooms out', () => {
    const zoomIn = run([{ type: 'wheel', point: { x: 0, y: 0 }, deltaPx: -100 }]);
    const zoomOut = run([{ type: 'wheel', point: { x: 0, y: 0 }, deltaPx: 100 }]);
    expect(zoomIn.viewport.zoom).toBeGreaterThan(view.zoom);
    expect(zoomOut.viewport.zoom).toBeLessThan(view.zoom);
  });

  it('wheel zoom keeps the board point under the cursor fixed', () => {
    fc.assert(
      fc.property(viewport, point, fc.integer({ min: -500, max: 500 }), (v, cursor, deltaPx) => {
        const result = navigate(INITIAL_NAVIGATION, v, { type: 'wheel', point: cursor, deltaPx });
        const before = screenToBoard(v, cursor);
        const after = screenToBoard(result.viewport, cursor);
        return closeTo(before, after, 1e-6 * Math.max(1, Math.abs(before.x), Math.abs(before.y)));
      }),
    );
  });
});
