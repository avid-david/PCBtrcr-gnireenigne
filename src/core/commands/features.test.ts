import { describe, expect, it } from 'vitest';
import { anchorPosition } from '../model/anchors';
import { bound, free, smdPad, trace, via, withFeatures } from '../model/features.test-support';
import { addFeature, moveFeatures, removeFeatures, updateFeature } from './features';

const board = withFeatures([
  smdPad('p1', { x: 0, y: 0 }),
  via('v1', { x: 10, y: 0 }),
  trace('t1', [bound('a', 'p1'), free('b', { x: 5, y: 5 }), bound('c', 'v1')]),
]);

describe('feature commands', () => {
  it('adds features on top', () => {
    const command = addFeature(via('v2', { x: 1, y: 1 }));
    expect(command.label).toBe('Add via');
    expect(command.execute(board).features.map((f) => f.id)).toEqual(['p1', 'v1', 't1', 'v2']);
  });

  it('updates a feature by id and ignores unknown ids', () => {
    const wider = updateFeature({ ...via('v1', { x: 10, y: 0 }), padMm: 1 });
    expect(wider.label).toBe('Edit via');
    expect(wider.execute(board).features[1]).toMatchObject({ padMm: 1 });
    expect(updateFeature(via('nope', { x: 0, y: 0 })).execute(board).features).toEqual(
      board.features,
    );
  });

  it('deleting a pad frees the trace end tied to it, in place', () => {
    const command = removeFeatures(['p1']);
    expect(command.label).toBe('Delete feature');
    const after = command.execute(board);
    expect(after.features.map((f) => f.id)).toEqual(['v1', 't1']);
    expect(after.features[1]).toMatchObject({
      vertices: [
        { id: 'a', kind: 'free', at: { x: 0, y: 0 } },
        { id: 'b' },
        { id: 'c', kind: 'bound' },
      ],
    });
    expect(removeFeatures(['p1', 'v1']).label).toBe('Delete 2 features');
  });

  it('moving a pad drags the trace end tied to it; moving the trace keeps its ties', () => {
    const movedPad = moveFeatures(['p1'], { x: 1, y: 2 }).execute(board);
    expect(anchorPosition(movedPad, 'a')).toEqual({ x: 1, y: 2 });
    const movedTrace = moveFeatures(['t1'], { x: 1, y: 0 }).execute(board);
    expect(anchorPosition(movedTrace, 'b')).toEqual({ x: 6, y: 5 });
    expect(anchorPosition(movedTrace, 'a')).toEqual({ x: 0, y: 0 });
    expect(moveFeatures(['p1', 'v1'], { x: 1, y: 0 }).label).toBe('Move 2 features');
  });

  it('returns the same project when nothing changes (no empty undo steps)', () => {
    expect(removeFeatures(['nope']).execute(board)).toBe(board);
    expect(moveFeatures(['p1'], { x: 0, y: 0 }).execute(board)).toBe(board);
    expect(moveFeatures(['nope'], { x: 1, y: 0 }).execute(board)).toBe(board);
    expect(moveFeatures(['p1'], { x: 1, y: 0 }).label).toBe('Move feature');
  });
});
