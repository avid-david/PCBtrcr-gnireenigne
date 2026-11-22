import { describe, expect, it } from 'vitest';
import { via, withFeatures } from '../core/model/features.test-support';
import { down, drive, move, up } from './harness.test-support';
import { selectTool } from './select';

// Locks in how the Select tool treats a press on the selection before M8 adds resize handles.
describe('select tool before resize handles', () => {
  it('pressing one of several selected features keeps them all and moves them together', () => {
    const project = withFeatures([via('a', { x: 0, y: 0 }), via('b', { x: 5, y: 0 })]);
    const r = drive(selectTool, { project, selection: ['a', 'b'] }, [
      down({ x: 0, y: 0 }),
      move({ x: 2, y: 0 }),
      up({ x: 2, y: 0 }),
    ]);
    expect(r.selection).toEqual(['a', 'b']);
    expect(r.project.features.map((f) => f.kind === 'via' && f.at)).toEqual([
      { x: 2, y: 0 },
      { x: 7, y: 0 },
    ]);
  });
});
