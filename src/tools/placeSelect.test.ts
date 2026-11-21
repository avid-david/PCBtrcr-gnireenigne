import { describe, expect, it } from 'vitest';
import { bound, free, smdPad, trace, via, withFeatures } from '../core/model/features.test-support';
import { createProject } from '../core/model/project';
import { alignTool } from './alignTool';
import { click, contextOf, down, drive, key, move, up } from './harness.test-support';
import { holeTool, padTool, pointTool, templateFeature, viaTool } from './place';
import {
  TOOLS,
  TOOL_ORDER,
  activate,
  stepTool,
  toolForKey,
  toolHint,
  toolOverlay,
  toolPreview,
} from './registry';
import { selectTool } from './select';
import { DEFAULT_SETTINGS, rememberDefaults } from './settings';

describe('place tools', () => {
  it('place one feature per click with the current defaults and select it', () => {
    const r = drive(viaTool, createProject(), click({ x: 2, y: 3 }));
    expect(r.project.features).toEqual([
      { kind: 'via', id: 'id1', at: { x: 2, y: 3 }, drillMm: 0.3, padMm: 0.6 },
    ]);
    expect(r.selection).toEqual(['id1']);
  });

  it('put SMD pads and points on the active layer, through-hole pads on all layers', () => {
    const smd = drive(
      padTool,
      { project: createProject(), ...{ activeLayerId: 'bottom' } },
      click({ x: 0, y: 0 }),
    );
    expect(smd.project.features[0]).toMatchObject({
      kind: 'pad',
      layerId: 'bottom',
      shape: 'rect',
    });
    const settings = { ...DEFAULT_SETTINGS, pad: { ...DEFAULT_SETTINGS.pad, throughHole: true } };
    const th = drive(padTool, { project: createProject(), ...{ settings } }, click({ x: 0, y: 0 }));
    expect(th.project.features[0]).toMatchObject({ layerId: null, drillMm: 1 });
    expect(
      drive(pointTool, createProject(), click({ x: 0, y: 0 })).project.features[0],
    ).toMatchObject({
      kind: 'point',
      layerId: 'top',
    });
    expect(
      drive(holeTool, createProject(), click({ x: 0, y: 0 })).project.features[0],
    ).toMatchObject({
      kind: 'hole',
      plated: false,
    });
  });

  it('show a ghost under the cursor, snapped to the grid', () => {
    const settings = { ...DEFAULT_SETTINGS, grid: { enabled: true, stepMm: 0.5 } };
    const hovered = drive(viaTool, { project: createProject(), ...{ settings } }, [
      move({ x: 1.3, y: 1.1 }),
    ]);
    expect(viaTool.overlay(hovered.state, contextOf(hovered, settings)).ghost).toMatchObject({
      at: { x: 1.5, y: 1 },
    });
    const cancelled = drive(viaTool, createProject(), [move({ x: 1, y: 1 }), { type: 'cancel' }]);
    expect(viaTool.overlay(cancelled.state, contextOf(cancelled)).ghost).toBeNull();
    expect(viaTool.hint(viaTool.initial, contextOf(cancelled))).toContain('via');
  });
});

const board = withFeatures([
  smdPad('top', { x: 0, y: 0 }),
  smdPad('bot', { x: 5, y: 0 }, 'bottom'),
  via('v', { x: 10, y: 0 }),
]);

describe('select tool', () => {
  it('selects the feature under the cursor; Shift toggles; inactive-layer features are skipped', () => {
    expect(drive(selectTool, board, click({ x: 0, y: 0 })).selection).toEqual(['top']);
    expect(
      drive(selectTool, { project: board, ...{ selection: ['top'] } }, click({ x: 10, y: 0 }, true))
        .selection,
    ).toEqual(['top', 'v']);
    expect(
      drive(selectTool, { project: board, ...{ selection: ['top'] } }, click({ x: 0, y: 0 }, true))
        .selection,
    ).toEqual([]);
    expect(drive(selectTool, board, click({ x: 5, y: 0 })).selection).toEqual([]);
  });

  it('drags selected features as a preview and moves them with one command on release', () => {
    const dragging = drive(selectTool, board, [down({ x: 10, y: 0 }), move({ x: 12, y: 1 })]);
    expect(selectTool.preview(dragging.state, board).features[2]).toMatchObject({
      at: { x: 12, y: 1 },
    });
    const dropped = drive(selectTool, board, [
      down({ x: 10, y: 0 }),
      move({ x: 12, y: 1 }),
      up({ x: 12, y: 1 }),
    ]);
    expect(dropped.project.features[2]).toMatchObject({ at: { x: 12, y: 1 } });
    const tiny = drive(selectTool, board, [
      down({ x: 10, y: 0 }),
      move({ x: 10.1, y: 0 }),
      up({ x: 10.1, y: 0 }),
    ]);
    expect(tiny.project).toBe(board);
  });

  it('box-selects features entirely inside, replacing or adding to the selection', () => {
    const box = [down({ x: -2, y: -2 }), move({ x: 11, y: 2 }), up({ x: 11, y: 2 })];
    const r = drive(selectTool, board, box);
    expect(r.selection).toEqual(['top', 'v']);
    const boxing = drive(selectTool, board, box.slice(0, 2));
    expect(selectTool.overlay(boxing.state, contextOf(boxing)).box).toEqual({
      minX: -2,
      minY: -2,
      maxX: 11,
      maxY: 2,
    });
    const additive = drive(
      selectTool,
      {
        project: board,
        ...{
          selection: ['top'],
        },
      },
      [down({ x: 9, y: -2 }, true), move({ x: 11, y: 2 }), up({ x: 11, y: 2 })],
    );
    expect(additive.selection).toEqual(['top', 'v']);
  });

  it('Delete removes the selection; Esc cancels a drag', () => {
    const deleted = drive(selectTool, { project: board, ...{ selection: ['v'] } }, [key('Delete')]);
    expect(deleted.project.features.map((f) => f.id)).toEqual(['top', 'bot']);
    expect(drive(selectTool, board, [key('Delete')]).project).toBe(board);
    const cancelled = drive(selectTool, board, [
      down({ x: 10, y: 0 }),
      move({ x: 12, y: 0 }),
      { type: 'cancel' },
      up({ x: 12, y: 0 }),
    ]);
    expect(cancelled.project).toBe(board);
    expect(selectTool.hint(selectTool.initial, contextOf(cancelled))).toContain('box-select');
  });
});

describe('tool registry', () => {
  it('lists every tool once with a unique shortcut', () => {
    expect(TOOL_ORDER).toEqual(Object.keys(TOOLS));
    const keys = TOOL_ORDER.map((id) => TOOLS[id].shortcut);
    expect(new Set(keys).size).toBe(keys.length);
    expect(toolForKey('t')).toBe('trace');
    expect(toolForKey('q')).toBeUndefined();
  });

  it('runs the active tool generically', () => {
    const ctx = contextOf({
      state: null,
      project: createProject(),
      selection: [],
      activeLayerId: 'top',
    });
    const active = activate('via');
    const { active: next, result } = stepTool(
      active,
      { type: 'pointerdown', board: { x: 1, y: 1 }, hitRadiusMm: 1, shift: false },
      ctx,
    );
    expect(next.id).toBe('via');
    expect(result.commands).toHaveLength(1);
    expect(toolHint(next, ctx)).toContain('via');
    expect(toolPreview(next, ctx.project)).toBe(ctx.project);
    expect(toolOverlay(next, ctx).ghost).toBeNull();
  });

  it('wraps align mode as a tool', () => {
    const ctx = contextOf({
      state: null,
      project: createProject(),
      selection: [],
      activeLayerId: 'top',
    });
    const r = alignTool.step(
      alignTool.initial,
      { type: 'pointerdown', board: { x: 1, y: 1 }, hitRadiusMm: 1, shift: false },
      ctx,
    );
    expect(r.commands).toEqual([]);
    expect(alignTool.step(alignTool.initial, { type: 'key', key: 'Enter' }, ctx).state).toBe(
      alignTool.initial,
    );
    expect(alignTool.hint(alignTool.initial, ctx)).toBe('Enter the board size first.');
    expect(alignTool.preview(alignTool.initial, ctx.project)).toBe(ctx.project);
    expect(alignTool.overlay(alignTool.initial, ctx).ghost).toBeNull();
  });
});

describe('select tool hit priority', () => {
  it('prefers a pad over the trace whose end lies on it', () => {
    const tied = withFeatures([
      smdPad('pad', { x: 0, y: 0 }),
      trace('t', [bound('a', 'pad'), free('b', { x: 5, y: 0 })]),
    ]);
    expect(drive(selectTool, tied, click({ x: 0, y: 0 })).selection).toEqual(['pad']);
    expect(drive(selectTool, tied, click({ x: 3, y: 0 })).selection).toEqual(['t']);
  });
});

describe('defaults', () => {
  it('remembers the sizes of an edited feature for the next one of its kind', () => {
    const pad = { ...smdPad('p', { x: 0, y: 0 }), widthMm: 2, shape: 'oval' as const };
    expect(rememberDefaults(DEFAULT_SETTINGS, pad).pad).toMatchObject({
      widthMm: 2,
      shape: 'oval',
      throughHole: false,
    });
    expect(rememberDefaults(DEFAULT_SETTINGS, via('v', { x: 0, y: 0 })).via).toEqual({
      drillMm: 0.3,
      padMm: 0.6,
    });
    expect(
      rememberDefaults(DEFAULT_SETTINGS, { ...trace('t', []), widthMm: 0.5 }).trace.widthMm,
    ).toBe(0.5);
  });

  it('builds a template feature from the defaults for every kind', () => {
    expect(templateFeature('trace', DEFAULT_SETTINGS, 'top')).toMatchObject({
      kind: 'trace',
      widthMm: 0.25,
    });
    expect(templateFeature('point', DEFAULT_SETTINGS, 'bottom')).toMatchObject({
      kind: 'point',
      layerId: 'bottom',
    });
  });
});
