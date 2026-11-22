import { describe, expect, it } from 'vitest';
import type { Vec2 } from '../core/geometry/vec2';
import { createProject } from '../core/model/project';
import { click, contextOf, down, drive, key, move, up, type Driven } from './harness.test-support';
import { DEFAULT_SETTINGS, type ToolSettings } from './settings';
import type { ToolEvent } from './tool';
import { isArmed, viaTool, type ViaState } from './via';

const KNOWN: ToolSettings = { ...DEFAULT_SETTINGS, viaSizeKnown: true };
const CANCEL: ToolEvent = { type: 'cancel' };

/** Press at `from`, move to `to` and release there. */
const dragged = (from: Vec2, to: Vec2): ToolEvent[] => [down(from), move(to), up(to)];

const run = (events: readonly ToolEvent[], settings: ToolSettings = DEFAULT_SETTINGS) =>
  drive(viaTool, { project: createProject(), settings }, events);

const sizes = (d: Driven<ViaState>) =>
  d.project.features.map((f) => (f.kind === 'via' ? [f.padMm, f.drillMm] : []));

const hintOf = (d: Driven<ViaState>, units: 'mm' | 'mil' = 'mm') =>
  viaTool.hint(d.state, { ...contextOf(d, d.settings), units });

describe('via tool: armed', () => {
  it('starts armed in a fresh session: a click places nothing and the hint asks for a drag', () => {
    const r = run(click({ x: 1, y: 1 }));
    expect(r.project.features).toEqual([]);
    expect(isArmed(r.state, r.settings)).toBe(true);
    expect(hintOf(r)).toContain('Drag from the centre of a via to its edge');
  });

  it('draws the first via to size, which becomes the default for the clicks after it', () => {
    const r = run([...dragged({ x: 0, y: 0 }, { x: 1, y: 0 }), ...click({ x: 5, y: 5 })]);
    expect(sizes(r)).toEqual([
      [2, 1],
      [2, 1],
    ]);
    expect(r.settings.via).toEqual({ padMm: 2, drillMm: 1 });
    expect(r.settings.viaSizeKnown).toBe(true);
    expect(r.selection).toEqual(['id2']);
    expect(hintOf(r)).toContain('Click to place a via');
  });

  it('Shift+V arms again even with a known size, and Esc disarms it', () => {
    const armed = run([key('Shift+v'), ...click({ x: 1, y: 1 })], KNOWN);
    expect(armed.project.features).toEqual([]);
    expect(isArmed(armed.state, KNOWN)).toBe(true);
    const disarmed = run([key('Shift+v'), CANCEL, ...click({ x: 1, y: 1 })], KNOWN);
    expect(sizes(disarmed)).toEqual([[0.6, 0.3]]);
  });

  it('stays armed after Esc while no size is known', () => {
    const r = run([key('Shift+v'), CANCEL]);
    expect(isArmed(r.state, r.settings)).toBe(true);
    expect(r.state.armed).toBe(true);
  });
});

describe('via tool: click or drag', () => {
  it('places on release, not on press', () => {
    expect(run([down({ x: 1, y: 1 })], KNOWN).project.features).toEqual([]);
    expect(run(click({ x: 1, y: 1 }), KNOWN).project.features).toHaveLength(1);
  });

  it('treats a release within 3 screen px of the press as a click, at any zoom', () => {
    // hitRadiusMm 0.5 is 10 px, so 3 px is 0.15 mm.
    const nudge = run(dragged({ x: 0, y: 0 }, { x: 0.14, y: 0 }), KNOWN);
    expect(sizes(nudge)).toEqual([[0.6, 0.3]]);
    expect(nudge.settings).toBe(KNOWN);
    const zoomedOut = drive(viaTool, { project: createProject(), settings: KNOWN }, [
      { type: 'pointerdown', board: { x: 0, y: 0 }, hitRadiusMm: 5, shift: false },
      { type: 'pointermove', board: { x: 1.4, y: 0 }, hitRadiusMm: 5 },
      up({ x: 1.4, y: 0 }),
    ]);
    expect(sizes(zoomedOut)).toEqual([[0.6, 0.3]]);
    expect(sizes(run(dragged({ x: 0, y: 0 }, { x: 0.2, y: 0 }), KNOWN))).toEqual([[0.4, 0.2]]);
  });

  it('gives the minimum size to a drag that ends back on the centre', () => {
    const r = run([
      down({ x: 0, y: 0 }),
      move({ x: 2, y: 0 }),
      move({ x: 0, y: 0 }),
      up({ x: 0, y: 0 }),
    ]);
    expect(sizes(r)).toEqual([[0.1, 0.05]]);
  });

  it('centres on the grid-snapped press point; the radius does not snap', () => {
    const settings = { ...DEFAULT_SETTINGS, grid: { enabled: true, stepMm: 0.5 } };
    const r = run(dragged({ x: 1.2, y: 1.1 }, { x: 1, y: 2.3 }), settings);
    expect(r.project.features[0]).toMatchObject({ at: { x: 1, y: 1 }, drillMm: 1.3 });
    expect(sizes(r)[0]?.[0]).toBeCloseTo(2.6, 9);
  });

  it('keeps the default drill-to-pad ratio, rounded to 0.01 mm', () => {
    const settings = { ...DEFAULT_SETTINGS, via: { drillMm: 0.3, padMm: 0.7 } };
    expect(sizes(run(dragged({ x: 0, y: 0 }, { x: 0.5, y: 0 }), settings))).toEqual([[1, 0.43]]);
  });

  it('clamps the pad to 10 mm', () => {
    expect(sizes(run(dragged({ x: 0, y: 0 }, { x: 8, y: 0 })))).toEqual([[10, 5]]);
  });
});

describe('via tool: cancelling', () => {
  it('Esc drops a drag in progress and the release then places nothing', () => {
    const r = run([down({ x: 0, y: 0 }), move({ x: 1, y: 0 }), CANCEL, up({ x: 1, y: 0 })], KNOWN);
    expect(r.project.features).toEqual([]);
    expect(r.state.drag).toBeNull();
  });

  it('drops a drag when the active layer changes before the release', () => {
    const pressed = run([down({ x: 0, y: 0 })], KNOWN);
    const bottom = { ...contextOf(pressed, KNOWN), activeLayerId: 'bottom' };
    const moved = viaTool.step(pressed.state, move({ x: 1, y: 0 }), bottom);
    expect(moved.state.drag).toBeNull();
    const released = viaTool.step(pressed.state, up({ x: 1, y: 0 }), bottom);
    expect(released.commands).toEqual([]);
    expect(released.state.drag).toBeNull();
    expect(viaTool.step(viaTool.initial, up({ x: 1, y: 0 }), bottom).commands).toEqual([]);
  });

  it('ignores other keys', () => {
    expect(run([key('Enter')]).state).toEqual(viaTool.initial);
  });
});

describe('via tool: overlay and hint', () => {
  it('shows a ghost of the via being drawn and its diameter in display units', () => {
    const r = run([down({ x: 0, y: 0 }), move({ x: 0.3, y: 0 })]);
    const ghost = viaTool.overlay(r.state, contextOf(r, r.settings)).ghost;
    expect(ghost).toMatchObject({ kind: 'via', at: { x: 0, y: 0 }, padMm: 0.6 });
    expect(hintOf(r)).toContain('Via diameter 0.6 mm');
    expect(hintOf(r, 'mil')).toContain('Via diameter 23.62 mil');
  });

  it('shows the default-size ghost at the press point until the drag starts, unless armed', () => {
    const pressed = run([move({ x: 3, y: 3 }), down({ x: 1, y: 1 })], KNOWN);
    expect(viaTool.overlay(pressed.state, contextOf(pressed, KNOWN)).ghost).toMatchObject({
      at: { x: 1, y: 1 },
      padMm: 0.6,
    });
    const armed = run([down({ x: 1, y: 1 })]);
    expect(viaTool.overlay(armed.state, contextOf(armed)).ghost).toBeNull();
    expect(viaTool.preview(armed.state, armed.project)).toBe(armed.project);
  });
});

describe('via tool: landmark offer (SPEC F9)', () => {
  const photo = { id: 'p', fileName: 'p.png', mimeType: 'image/png', widthPx: 100, heightPx: 100 };
  const existing = {
    kind: 'via',
    id: 'old',
    at: { x: 0, y: 0 },
    drillMm: 0.3,
    padMm: 0.6,
  } as const;
  const project = {
    ...createProject(),
    layers: createProject().layers.map((l) => ({ ...l, image: photo })),
    features: [existing],
  };
  const place = (at: Vec2, settings: ToolSettings = KNOWN) => {
    const ctx = {
      ...contextOf(
        { state: viaTool.initial, project, selection: [], activeLayerId: 'bottom' },
        settings,
      ),
      newId: () => 'new',
    };
    const pressed = viaTool.step(viaTool.initial, down(at), ctx);
    return viaTool.step(pressed.state, up(at), ctx);
  };

  it('offers the via it was placed over, remembering the active layer', () => {
    expect(place({ x: 0.3, y: 0 }).landmark).toEqual({
      newViaId: 'new',
      existingViaId: 'old',
      at: { x: 0, y: 0 },
      activeLayerId: 'bottom',
      otherLayerId: 'top',
    });
  });

  it('offers nothing away from other vias, or with the preference off', () => {
    expect(place({ x: 5, y: 0 }).landmark).toBeNull();
    expect(place({ x: 0.3, y: 0 }, { ...KNOWN, offerLandmarks: false }).landmark).toBeNull();
    expect(DEFAULT_SETTINGS.offerLandmarks).toBe(true);
  });
});
