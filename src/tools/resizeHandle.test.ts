import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { EMPTY_HISTORY, execute, undo } from '../core/commands/history';
import { styleNet } from '../core/commands/netStyles';
import {
  free,
  hole,
  testPoint,
  trace,
  via,
  withFeatures,
} from '../core/model/features.test-support';
import type { Feature, Via } from '../core/model/features';
import type { Project } from '../core/model/project';
import { contextOf, down, drive, move, up } from './harness.test-support';
import {
  grabHandle,
  followHandle,
  handlePosition,
  radiusOf,
  releaseHandle,
  resizeHandle,
  resizedFeature,
  type Resizable,
} from './resizeHandle';
import { selectTool } from './select';
import { DEFAULT_SETTINGS } from './settings';
import { VIA_PAD_MAX_MM, VIA_PAD_MIN_MM } from './viaSize';

// The harness sends a hit radius of 0.5 mm for 10 px: 1 px = 0.05 mm, so the handle needs a
// radius of at least 0.4 mm, grabs within 0.25 mm, and a move under 0.15 mm is still a click.
const MM_PER_PX = 0.05;
const SEED = { seed: 11 };

/** A via with a 2 mm pad (20 px radius), large enough for a handle; its handle is at (1, 0). */
const bigVia = (id = 'v', at = { x: 0, y: 0 }): Via => ({ ...via(id, at), padMm: 2, drillMm: 1 });

const start = (features: Feature[], selection = ['v']) => ({
  project: withFeatures(features),
  selection,
});

const ctxOf = (project: Project, selection: string[], activeLayerId = 'top') =>
  contextOf({ project, selection, activeLayerId, state: null });

const dragHandle = (features: Feature[], to: { x: number; y: number }, from = { x: 1, y: 0 }) =>
  drive(selectTool, start(features, [features[0]?.id ?? '']), [down(from), move(to), up(to)]);

describe('resize handle', () => {
  it('sits on the +x edge of the one selected, editable via, hole or point', () => {
    const project = withFeatures([bigVia(), { ...hole('h', { x: 5, y: 0 }, true), diameterMm: 2 }]);
    expect(resizeHandle(ctxOf(project, ['v']), MM_PER_PX)).toEqual({
      id: 'v',
      centre: { x: 0, y: 0 },
      at: { x: 1, y: 0 },
    });
    expect(resizeHandle(ctxOf(project, ['h']), MM_PER_PX)?.at).toEqual({ x: 6, y: 0 });
    expect(resizeHandle(ctxOf(project, ['v', 'h']), MM_PER_PX)).toBeNull();
    expect(resizeHandle(ctxOf(project, []), MM_PER_PX)).toBeNull();
  });

  it('is not shown for other kinds, inactive layers or locked nets', () => {
    const point = { ...testPoint('p', { x: 0, y: 0 }, 'bottom'), diameterMm: 2 };
    const line = trace('t', [free('a', { x: 0, y: 0 }), free('b', { x: 5, y: 0 })]);
    const project = withFeatures([point, line, bigVia('v', { x: 9, y: 0 })]);
    expect(resizeHandle(ctxOf(project, ['p']), MM_PER_PX)).toBeNull();
    expect(resizeHandle(ctxOf(project, ['p'], 'bottom'), MM_PER_PX)?.id).toBe('p');
    expect(resizeHandle(ctxOf(project, ['t']), MM_PER_PX)).toBeNull();
    const locked = styleNet('v', { locked: true }).execute(project);
    expect(resizeHandle(ctxOf(locked, ['v']), MM_PER_PX)).toBeNull();
  });

  it('is shown only from 8 px on-screen radius, except while it is dragged', () => {
    const project = withFeatures([via('v', { x: 0, y: 0 })]); // 0.3 mm = 6 px
    expect(resizeHandle(ctxOf(project, ['v']), MM_PER_PX)).toBeNull();
    expect(resizeHandle(ctxOf(project, ['v']), 0.03)?.at).toEqual({ x: 0.3, y: 0 }); // 10 px
    expect(handlePosition({ mode: 'idle' }, ctxOf(project, ['v']), MM_PER_PX)).toBeNull();
    expect(handlePosition({ mode: 'resizing' }, ctxOf(project, ['v']), MM_PER_PX)).toEqual({
      x: 0.3,
      y: 0,
    });
  });
});

describe('select tool resize handles', () => {
  it('drags a via to a new pad, keeps its drill ratio and makes it the default', () => {
    const r = dragHandle([bigVia()], { x: 1.5, y: 0 });
    expect(r.project.features[0]).toMatchObject({ padMm: 3, drillMm: 1.5, at: { x: 0, y: 0 } });
    expect(r.selection).toEqual(['v']);
    expect(r.settings.via).toEqual({ padMm: 3, drillMm: 1.5 });
    expect(r.settings.viaSizeKnown).toBe(true);
  });

  it('resizes holes and points by their diameter and remembers it', () => {
    const h = dragHandle([{ ...hole('h', { x: 0, y: 0 }, true), diameterMm: 2 }], { x: 0, y: 2 });
    expect(h.project.features[0]).toMatchObject({ diameterMm: 4 });
    expect(h.settings.hole).toEqual({ diameterMm: 4, plated: true });
    const p = dragHandle([{ ...testPoint('p', { x: 0, y: 0 }), diameterMm: 2 }], { x: 0.75, y: 0 });
    expect(p.project.features[0]).toMatchObject({ diameterMm: 1.5 });
    expect(p.settings.point).toEqual({ diameterMm: 1.5 });
  });

  it('clamps to 0.1–10 mm like a drawn via', () => {
    expect(dragHandle([bigVia()], { x: 0, y: 0 }).project.features[0]).toMatchObject({
      padMm: 0.1,
      drillMm: 0.05,
    });
    expect(dragHandle([bigVia()], { x: 30, y: 0 }).project.features[0]).toMatchObject({
      padMm: 10,
      drillMm: 5,
    });
    const tiny = dragHandle([{ ...hole('h', { x: 0, y: 0 }, false), diameterMm: 2 }], {
      x: 0.01,
      y: 0,
    });
    expect(tiny.project.features[0]).toMatchObject({ diameterMm: 0.1 });
  });

  it('wins over a feature under the handle; a press at the centre still moves', () => {
    const other = via('w', { x: 1, y: 0 });
    const resized = drive(selectTool, start([bigVia(), other]), [
      down({ x: 1, y: 0 }),
      move({ x: 2, y: 0 }),
      up({ x: 2, y: 0 }),
    ]);
    expect(resized.selection).toEqual(['v']);
    expect(resized.project.features).toEqual([{ ...bigVia(), padMm: 4, drillMm: 2 }, other]);
    const moved = drive(selectTool, start([bigVia()]), [
      down({ x: 0, y: 0 }),
      move({ x: 2, y: 0 }),
      up({ x: 2, y: 0 }),
    ]);
    expect(moved.project.features[0]).toMatchObject({ at: { x: 2, y: 0 }, padMm: 2 });
  });

  it('moves a via too small for a handle, even when pressed at its edge', () => {
    const r = drive(selectTool, start([via('v', { x: 0, y: 0 })]), [
      down({ x: 0.25, y: 0 }),
      move({ x: 2.25, y: 0 }),
      up({ x: 2.25, y: 0 }),
    ]);
    expect(r.project.features[0]).toMatchObject({ at: { x: 2, y: 0 }, padMm: 0.6 });
  });

  it('makes no edit when the pointer moves less than 3 px, or after Esc', () => {
    const from = start([bigVia()]);
    const still = drive(selectTool, from, [
      down({ x: 1, y: 0 }),
      move({ x: 1.1, y: 0 }),
      up({ x: 1.1, y: 0 }),
    ]);
    expect(still.project).toBe(from.project);
    expect(still.settings).toBe(DEFAULT_SETTINGS);
    const cancelled = drive(selectTool, from, [
      down({ x: 1, y: 0 }),
      move({ x: 2, y: 0 }),
      { type: 'cancel' },
      up({ x: 2, y: 0 }),
    ]);
    expect(cancelled.project).toBe(from.project);
    expect(cancelled.state).toEqual({ mode: 'idle' });
  });

  it('drops the drag on a layer switch, or when the feature is gone', () => {
    const point = { ...testPoint('p', { x: 0, y: 0 }), diameterMm: 2 };
    const project = withFeatures([point]);
    const grabbed = grabHandle(ctxOf(project, ['p']), { x: 1, y: 0 }, 0.5);
    expect(grabbed).not.toBeNull();
    if (grabbed === null) {
      return;
    }
    expect(followHandle(grabbed, { x: 2, y: 0 }, ctxOf(project, ['p'], 'bottom'))).toBeNull();
    const dragged = { ...grabbed, radiusMm: 2 };
    expect(releaseHandle(dragged, ctxOf(project, ['p'], 'bottom'))).toBeNull();
    expect(releaseHandle(dragged, ctxOf(withFeatures([]), ['p']))).toBeNull();
    expect(followHandle(grabbed, { x: 2, y: 0 }, ctxOf(withFeatures([]), ['p']))).toBeNull();
    // In the Select tool, a dropped drag goes back to idle, and the release edits nothing.
    const onBottom = ctxOf(project, ['p'], 'bottom');
    const moved = selectTool.step(
      grabbed,
      { type: 'pointermove', board: { x: 2, y: 0 }, hitRadiusMm: 0.5 },
      onBottom,
    );
    expect(moved.state).toEqual({ mode: 'idle' });
    expect(
      selectTool.step(dragged, { type: 'pointerup', board: { x: 2, y: 0 } }, onBottom).commands,
    ).toEqual([]);
  });

  it('previews the live size and shows the diameter in the hint', () => {
    const from = start([bigVia()]);
    const pressed = drive(selectTool, from, [down({ x: 1, y: 0 })]);
    expect(selectTool.preview(pressed.state, from.project)).toBe(from.project);
    expect(selectTool.hint(pressed.state, contextOf(pressed))).toBe(
      'Diameter 2 mm. Release to resize; Esc cancels.',
    );
    const dragging = drive(selectTool, from, [down({ x: 1, y: 0 }), move({ x: 1.5, y: 0 })]);
    expect(selectTool.preview(dragging.state, from.project).features[0]).toMatchObject({
      padMm: 3,
    });
    expect(selectTool.hint(dragging.state, contextOf(dragging))).toBe(
      'Diameter 3 mm. Release to resize; Esc cancels.',
    );
    const gone = contextOf({ ...dragging, project: withFeatures([]) });
    expect(selectTool.hint(dragging.state, gone)).toBe('Release to resize; Esc cancels.');
    expect(selectTool.hint(selectTool.initial, contextOf(dragging))).toContain('round handle');
  });
});

describe('resize handle properties', () => {
  const resizable = fc.oneof(
    fc.double({ min: 0.1, max: 10, noNaN: true }).map((padMm): Resizable => ({
      ...via('f', { x: 0, y: 0 }),
      padMm,
      drillMm: padMm / 2,
    })),
    fc.double({ min: 0.1, max: 10, noNaN: true }).map((diameterMm): Resizable => ({
      ...hole('f', { x: 0, y: 0 }, true),
      diameterMm,
    })),
    fc.double({ min: 0.1, max: 10, noNaN: true }).map((diameterMm): Resizable => ({
      ...testPoint('f', { x: 0, y: 0 }),
      diameterMm,
    })),
  );
  const radius = fc.double({ min: 0, max: 20, noNaN: true });

  it('undo after a resize restores the exact previous project', () => {
    fc.assert(
      fc.property(resizable, radius, (f, r) => {
        const project = withFeatures([f]);
        const ctx = ctxOf(project, ['f']);
        // At 0.001 mm/px every feature is big enough for a handle; press right on it.
        const grabbed = grabHandle(ctx, { x: radiusOf(f), y: 0 }, 0.01);
        const done = grabbed === null ? null : releaseHandle({ ...grabbed, radiusMm: r }, ctx);
        expect(done).not.toBeNull();
        if (done === null) {
          return;
        }
        const step = execute(project, EMPTY_HISTORY, done.command);
        expect(undo(step.project, step.history)?.project).toBe(project);
      }),
      SEED,
    );
  });

  it('the resized diameter is twice the drag distance, clamped', () => {
    fc.assert(
      fc.property(resizable, radius, (f, r) => {
        const resized = resizedFeature(f, r);
        const diameter = resized.kind === 'via' ? resized.padMm : resized.diameterMm;
        expect(diameter).toBe(Math.min(VIA_PAD_MAX_MM, Math.max(VIA_PAD_MIN_MM, 2 * r)));
      }),
      SEED,
    );
  });
});
