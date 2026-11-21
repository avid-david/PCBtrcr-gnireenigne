import { describe, expect, it } from 'vitest';
import {
  free,
  plane,
  square,
  trace,
  twoPadComponent,
  via,
  withFeatures,
} from '../core/model/features.test-support';
import { createProject } from '../core/model/project';
import { componentTool } from './component';
import { click, contextOf, down, drive, key, move, up } from './harness.test-support';
import { textTool, templateFeature } from './place';
import { planeTool, silkTool } from './polyline';
import { toolTemplateKind } from './registry';
import { selectTool } from './select';
import { DEFAULT_SETTINGS, rememberDefaults, type ToolSettings } from './settings';

const dblclick = (x: number, y: number) => ({ type: 'doubleclick' as const, board: { x, y } });

const header: ToolSettings = {
  ...DEFAULT_SETTINGS,
  component: {
    familyId: 'pin-header',
    params: { rows: '1', pins: 2, pitch: '2.54' },
    prefix: 'J',
    value: 'PWR',
  },
};

describe('component tool', () => {
  it('places the chosen footprint with the next designator, pads with fresh ids', () => {
    const existing = { ...twoPadComponent('c', { x: 50, y: 50 }), designator: 'J1' };
    const r = drive(
      componentTool,
      { project: withFeatures([existing]), settings: header },
      click({ x: 10, y: 10 }),
    );
    const placed = r.project.features[1];
    expect(placed).toMatchObject({
      kind: 'component',
      designator: 'J2',
      value: 'PWR',
      layerId: 'top',
      flipped: false,
      at: { x: 10, y: 10 },
      footprint: { id: 'pin-header', name: 'PinHeader_1x02_P2.54mm' },
    });
    expect(placed?.kind === 'component' && placed.pads.map((p) => p.id)).toEqual(['id2', 'id3']);
    expect(r.selection).toEqual(['id1']);
  });

  it('R turns and F flips the next part; flipped parts land on the other side, which becomes active', () => {
    const r = drive(componentTool, { project: createProject(), settings: header }, [
      key('r'),
      key('r'),
      key('f'),
      ...click({ x: 0, y: 0 }),
    ]);
    expect(r.project.features[0]).toMatchObject({
      rotationDeg: 180,
      layerId: 'bottom',
      flipped: true,
    });
    expect(r.activeLayerId).toBe('bottom');
  });

  it('shows a ghost under the cursor, names what it places, and ignores invalid footprints', () => {
    const moved = drive(componentTool, { project: createProject(), settings: header }, [
      move({ x: 1, y: 2 }),
    ]);
    const ctx = contextOf(moved, header);
    expect(componentTool.overlay(moved.state, ctx).ghost).toMatchObject({
      kind: 'component',
      at: { x: 1, y: 2 },
    });
    expect(componentTool.hint(moved.state, ctx)).toContain('Pin header as J1');
    expect(componentTool.hint({ ...moved.state, otherSide: true }, contextOf(moved))).toContain(
      'on the other side',
    );
    const bad = { ...header, component: { ...header.component, familyId: 'nope' } };
    expect(
      drive(componentTool, { project: createProject(), settings: bad }, click({ x: 0, y: 0 }))
        .project.features,
    ).toEqual([]);
    expect(componentTool.hint(moved.state, contextOf(moved, bad))).toContain('footprint');
    const cancelled = drive(componentTool, createProject(), [
      move({ x: 1, y: 1 }),
      { type: 'cancel' },
    ]);
    expect(cancelled.state.cursor).toBeNull();
    expect(componentTool.overlay(cancelled.state, contextOf(cancelled)).ghost).toBeNull();
  });
});

describe('plane and silkscreen tools', () => {
  it('draws a plane outline of at least three corners on the active layer', () => {
    const r = drive(planeTool, { project: createProject(), activeLayerId: 'bottom' }, [
      ...click({ x: 0, y: 0 }),
      ...click({ x: 0, y: 0 }),
      ...click({ x: 10, y: 0 }),
      key('Enter'),
      ...click({ x: 10, y: 10 }),
      key('Enter'),
    ]);
    expect(r.project.features).toEqual([]);
    const done = drive(planeTool, createProject(), [
      ...click({ x: 0, y: 0 }),
      ...click({ x: 10, y: 0 }),
      ...click({ x: 20, y: 0 }),
      key('Backspace'),
      ...click({ x: 10, y: 10 }),
      dblclick(10, 10),
    ]);
    expect(done.project.features).toEqual([
      {
        kind: 'plane',
        id: 'id1',
        layerId: 'top',
        outline: [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
          { x: 10, y: 10 },
        ],
        attached: [],
      },
    ]);
    expect(done.selection).toEqual(['id1']);
  });

  it('closes the plane preview and explains the next step', () => {
    const r = drive(planeTool, createProject(), [
      ...click({ x: 0, y: 0 }),
      ...click({ x: 4, y: 0 }),
      move({ x: 4, y: 4 }),
    ]);
    const ctx = contextOf(r);
    expect(planeTool.overlay(r.state, ctx).rubberBand?.points).toEqual([
      { x: 0, y: 0 },
      { x: 4, y: 0 },
      { x: 4, y: 4 },
      { x: 0, y: 0 },
    ]);
    expect(planeTool.hint(r.state, ctx)).toContain('at least 3');
    const three = drive(
      planeTool,
      createProject(),
      [0, 1, 2].flatMap((i) => click({ x: i, y: i * i })),
    );
    expect(planeTool.hint(three.state, contextOf(three))).toContain('Enter finishes');
    expect(planeTool.overlay(planeTool.initial, ctx).rubberBand).toBeNull();
    const cleared = drive(planeTool, createProject(), [
      ...click({ x: 0, y: 0 }),
      key('Backspace'),
      { type: 'cancel' },
    ]);
    expect(cleared.state.points).toEqual([]);
  });

  it('draws silkscreen lines in line mode and places text in text mode', () => {
    const line = drive(silkTool, createProject(), [
      ...click({ x: 0, y: 0 }),
      ...click({ x: 5, y: 0 }),
      key('Enter'),
    ]);
    expect(line.project.features[0]).toMatchObject({
      kind: 'silkLine',
      widthMm: 0.15,
      points: [
        { x: 0, y: 0 },
        { x: 5, y: 0 },
      ],
    });
    const textMode = {
      ...DEFAULT_SETTINGS,
      silk: { ...DEFAULT_SETTINGS.silk, mode: 'text' as const, text: 'U1' },
    };
    const placed = drive(silkTool, { project: createProject(), settings: textMode }, [
      move({ x: 1, y: 1 }),
      ...click({ x: 2, y: 2 }),
    ]);
    expect(placed.project.features[0]).toMatchObject({
      kind: 'silkText',
      text: 'U1',
      at: { x: 2, y: 2 },
    });
    expect(silkTool.overlay(placed.state, contextOf(placed, textMode)).ghost).toMatchObject({
      kind: 'silkText',
    });
    expect(silkTool.overlay(silkTool.initial, contextOf(placed, textMode)).ghost).toBeNull();
    expect(silkTool.hint(placed.state, contextOf(placed, textMode))).toContain('silkscreen text');
    expect(silkTool.hint(line.state, contextOf(line))).toContain('silkscreen line');
    expect(silkTool.overlay(line.state, contextOf(line)).rubberBand).toBeNull();
  });

  it('places text notes, shows their defaults and remembers sizes', () => {
    const r = drive(
      textTool,
      { project: createProject(), activeLayerId: 'bottom' },
      click({ x: 3, y: 4 }),
    );
    expect(r.project.features[0]).toEqual({
      kind: 'text',
      id: 'id1',
      layerId: 'bottom',
      at: { x: 3, y: 4 },
      text: 'Note',
      heightMm: 1.5,
    });
    expect(toolTemplateKind('text', DEFAULT_SETTINGS)).toBe('text');
    expect(toolTemplateKind('silk', DEFAULT_SETTINGS)).toBe('silkLine');
    expect(toolTemplateKind('plane', DEFAULT_SETTINGS)).toBeNull();
    expect(templateFeature('silkLine', DEFAULT_SETTINGS, 'top')).toMatchObject({
      widthMm: 0.15,
      points: [],
    });
    const remembered = [
      {
        kind: 'text' as const,
        id: 't',
        layerId: 'top',
        at: { x: 0, y: 0 },
        text: 'x',
        heightMm: 3,
      },
      {
        kind: 'silkText' as const,
        id: 's',
        layerId: 'top',
        at: { x: 0, y: 0 },
        text: 'x',
        heightMm: 2,
      },
      { kind: 'silkLine' as const, id: 'l', layerId: 'top', points: [], widthMm: 0.3 },
    ].reduce(rememberDefaults, DEFAULT_SETTINGS);
    expect([remembered.text.heightMm, remembered.silk.heightMm, remembered.silk.widthMm]).toEqual([
      3, 2, 0.3,
    ]);
    expect(rememberDefaults(DEFAULT_SETTINGS, twoPadComponent('c', { x: 0, y: 0 }))).toBe(
      DEFAULT_SETTINGS,
    );
  });
});

describe('select tool and components', () => {
  const start = () => ({
    project: withFeatures([
      twoPadComponent('c', { x: 0, y: 0 }),
      twoPadComponent('d', { x: 9, y: 0 }),
    ]),
    selection: ['c', 'd'],
  });

  it('R rotates the selected components by a quarter turn', () => {
    const r = drive(selectTool, start(), [key('r')]);
    expect(r.project.features.map((f) => f.kind === 'component' && f.rotationDeg)).toEqual([
      90, 90,
    ]);
  });

  it('F flips them to the other side and makes that side active', () => {
    const r = drive(selectTool, start(), [key('f')]);
    expect(r.project.features.map((f) => f.kind === 'component' && f.layerId)).toEqual([
      'bottom',
      'bottom',
    ]);
    expect(r.activeLayerId).toBe('bottom');
  });

  it('R and F do nothing without selected components', () => {
    const r = drive(selectTool, { ...start(), selection: [] }, [key('r'), key('f'), key('Delete')]);
    expect(r.project.features).toEqual(start().project.features);
    expect(r.activeLayerId).toBe('top');
  });
});

describe('select tool and planes', () => {
  const board = () =>
    withFeatures([
      twoPadComponent('c', { x: 0, y: 0 }),
      via('v', { x: 5, y: 0 }),
      trace('t', [free('t1', { x: -5, y: 4 }), free('t2', { x: 5, y: 4 })]),
      plane('p', square(-10, -10, 20)),
    ]);

  it('selects what lies on a plane, even when the plane was drawn later', () => {
    expect(drive(selectTool, board(), click({ x: 0, y: 0 })).selection).toEqual(['c']);
    expect(drive(selectTool, board(), click({ x: 5, y: 0 })).selection).toEqual(['v']);
    expect(drive(selectTool, board(), click({ x: 0, y: 4 })).selection).toEqual(['t']);
    expect(drive(selectTool, board(), click({ x: -8, y: -8 })).selection).toEqual(['p']);
  });

  it('drags a pad-carrying part that lies on a plane, not the plane', () => {
    const r = drive(selectTool, board(), [
      down({ x: 0, y: 0 }),
      move({ x: 2, y: 0 }),
      up({ x: 2, y: 0 }),
    ]);
    expect(r.project.features.find((f) => f.id === 'c')).toMatchObject({ at: { x: 2, y: 0 } });
    expect(r.project.features.find((f) => f.id === 'p')).toMatchObject({
      outline: square(-10, -10, 20),
    });
  });
});
