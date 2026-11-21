import { describe, expect, it } from 'vitest';
import { deriveNets } from '../core/connectivity/nets';
import { anchorPosition } from '../core/model/anchors';
import { smdPad, via, withFeatures } from '../core/model/features.test-support';
import { click, contextOf, drive, key, move } from './harness.test-support';
import { DEFAULT_SETTINGS } from './settings';
import { traceTool } from './trace';

const board = withFeatures([
  smdPad('p1', { x: 0, y: 0 }),
  via('v1', { x: 10, y: 0 }),
  smdPad('pb', { x: 5, y: 5 }, 'bottom'),
]);

describe('trace tool', () => {
  it('draws a trace snapped to a pad and a via, finished with Enter, as one command', () => {
    const r = drive(traceTool, board, [
      ...click({ x: 0.2, y: 0.1 }),
      ...click({ x: 5, y: 3 }),
      ...click({ x: 9.8, y: 0.2 }),
      key('Enter'),
    ]);
    const trace = r.project.features.at(-1);
    expect(trace).toMatchObject({ kind: 'trace', layerId: 'top', widthMm: 0.25 });
    expect(trace?.kind === 'trace' && trace.vertices.map((v) => v.kind)).toEqual([
      'bound',
      'free',
      'bound',
    ]);
    expect(deriveNets(r.project).netOfFeature('v1')?.id).toBe('p1');
    expect(r.state.points).toEqual([]);
  });

  it('finishes with a double-click and ignores the duplicate click it brings', () => {
    const r = drive(traceTool, board, [
      ...click({ x: 0, y: 0 }),
      ...click({ x: 4, y: 4 }),
      ...click({ x: 4, y: 4 }),
      { type: 'doubleclick', board: { x: 4, y: 4 } },
    ]);
    const trace = r.project.features.at(-1);
    expect(trace?.kind === 'trace' && trace.vertices).toHaveLength(2);
  });

  it('does not snap to anchors on the other layer', () => {
    const r = drive(traceTool, board, [
      ...click({ x: 5, y: 5 }),
      ...click({ x: 8, y: 8 }),
      key('Enter'),
    ]);
    const trace = r.project.features.at(-1);
    expect(trace?.kind === 'trace' && trace.vertices[0]?.kind).toBe('free');
  });

  it('Backspace removes the last point, Esc cancels, a single point is not a trace', () => {
    const backspaced = drive(traceTool, board, [
      ...click({ x: 0, y: 0 }),
      ...click({ x: 3, y: 3 }),
      key('Backspace'),
    ]);
    expect(backspaced.state.points).toHaveLength(1);
    expect(
      drive(traceTool, board, [...click({ x: 0, y: 0 }), key('Backspace')]).state.points,
    ).toEqual([]);
    const cancelled = drive(traceTool, board, [...click({ x: 0, y: 0 }), { type: 'cancel' }]);
    expect(cancelled.state.points).toEqual([]);
    const single = drive(traceTool, board, [...click({ x: 0, y: 0 }), key('Enter')]);
    expect(single.project).toBe(board);
    expect(drive(traceTool, board, [key('x')]).project).toBe(board);
  });

  it('keeps the layer it started on, uses the grid and shows a rubber band', () => {
    const settings = { ...DEFAULT_SETTINGS, grid: { enabled: true, stepMm: 1 } };
    const started = drive(traceTool, { project: board, ...{ settings } }, [
      ...click({ x: 3.4, y: 3.6 }),
      move({ x: 0.1, y: 0 }),
    ]);
    expect(started.state.points[0]?.at).toEqual({ x: 3, y: 4 });
    const overlay = traceTool.overlay(started.state, contextOf(started));
    expect(overlay.rubberBand?.points).toEqual([
      { x: 3, y: 4 },
      { x: 0, y: 0 },
    ]);
    expect(overlay.snapTarget).toEqual({ x: 0, y: 0 });
    const onBottom = { ...started, activeLayerId: 'bottom' };
    const finished = drive(
      traceTool,
      {
        project: onBottom.project,
        ...{
          activeLayerId: 'bottom',
        },
      },
      [...click({ x: 7, y: 7 }), key('Enter')],
    );
    expect(finished.project.features.at(-1)).toMatchObject({ layerId: 'bottom' });
    expect(traceTool.overlay(traceTool.initial, contextOf(started)).rubberBand).toBeNull();
  });

  it('ties a new trace to a bound vertex of another trace via its root anchor', () => {
    const first = drive(traceTool, board, [
      ...click({ x: 0, y: 0 }),
      ...click({ x: 4, y: 0 }),
      key('Enter'),
    ]);
    const second = drive(traceTool, first.project, [
      ...click({ x: 0, y: 0.1 }),
      ...click({ x: 0, y: 4 }),
      key('Enter'),
    ]);
    const trace = second.project.features.at(-1);
    expect(trace?.kind === 'trace' && trace.vertices[0]).toMatchObject({
      kind: 'bound',
      anchor: 'p1',
    });
    expect(anchorPosition(second.project, 'p1')).toEqual({ x: 0, y: 0 });
  });

  it('describes what to do', () => {
    const ctx = contextOf(drive(traceTool, board, []));
    expect(traceTool.hint(traceTool.initial, ctx)).toContain('Click to start a trace');
    const drawing = drive(traceTool, board, click({ x: 0, y: 0 }));
    expect(traceTool.hint(drawing.state, ctx)).toContain('Double-click or Enter finishes');
    expect(traceTool.preview(drawing.state, board)).toBe(board);
  });
});
