import { describe, expect, it } from 'vitest';
import { styleNet } from '../core/commands/netStyles';
import {
  free,
  plane,
  square,
  trace,
  twoPadComponent,
  via,
  withFeatures,
} from '../core/model/features.test-support';
import { click, down, drive, key, move, up } from './harness.test-support';
import { selectTool } from './select';

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

describe('select tool and locked nets', () => {
  it('cannot select, box-select or drag the features of a locked net', () => {
    const project = styleNet('v', { locked: true }).execute(
      withFeatures([via('v', { x: 0, y: 0 }), via('w', { x: 5, y: 0 })]),
    );
    expect(drive(selectTool, project, click({ x: 0, y: 0 })).selection).toEqual([]);
    const boxed = drive(selectTool, project, [
      down({ x: -2, y: -2 }),
      move({ x: 7, y: 2 }),
      up({ x: 7, y: 2 }),
    ]);
    expect(boxed.selection).toEqual(['w']);
    const dragged = drive(selectTool, project, [
      down({ x: 0, y: 0 }),
      move({ x: 3, y: 3 }),
      up({ x: 3, y: 3 }),
    ]);
    expect(dragged.project).toBe(project);
  });
});
