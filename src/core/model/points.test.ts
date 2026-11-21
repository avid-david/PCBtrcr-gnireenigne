import { describe, expect, it } from 'vitest';
import {
  getPoint,
  movePoint,
  pointsOnLayer,
  removePoint,
  samePoint,
  type PointRef,
} from './points';
import { createProject, type Project } from './project';

const corner: PointRef = { kind: 'corner', layerId: 'top', corner: 'tl' };
const matchTop: PointRef = { kind: 'match', layerId: 'top', matchId: 'm1' };
const matchBottom: PointRef = { kind: 'match', layerId: 'bottom', matchId: 'm1' };

const withMatch: Project = {
  ...createProject(),
  matches: [{ id: 'm1', points: { top: { x: 1, y: 2 }, bottom: { x: 3, y: 4 } } }],
};

describe('alignment points', () => {
  it('moves (creates) and reads corner points', () => {
    const project = movePoint(createProject(), corner, { x: 5, y: 6 });
    expect(getPoint(project, corner)).toEqual({ x: 5, y: 6 });
    expect(getPoint(createProject(), corner)).toBeUndefined();
  });

  it('removes a corner and leaves the others', () => {
    const both = movePoint(
      movePoint(createProject(), corner, { x: 1, y: 1 }),
      { ...corner, corner: 'tr' },
      {
        x: 2,
        y: 2,
      },
    );
    const removed = removePoint(both, corner);
    expect(getPoint(removed, corner)).toBeUndefined();
    expect(getPoint(removed, { ...corner, corner: 'tr' })).toEqual({ x: 2, y: 2 });
  });

  it('moves one side of a match and removes the whole match', () => {
    const moved = movePoint(withMatch, matchBottom, { x: 9, y: 9 });
    expect(getPoint(moved, matchBottom)).toEqual({ x: 9, y: 9 });
    expect(getPoint(moved, matchTop)).toEqual({ x: 1, y: 2 });
    expect(movePoint(withMatch, { ...matchTop, matchId: 'other' }, { x: 0, y: 0 })).toEqual(
      withMatch,
    );
    expect(removePoint(withMatch, matchTop).matches).toEqual([]);
  });

  it('compares references', () => {
    expect(samePoint(corner, { ...corner })).toBe(true);
    expect(samePoint(corner, { ...corner, corner: 'br' })).toBe(false);
    expect(samePoint(matchTop, { ...matchTop })).toBe(true);
    expect(samePoint(matchTop, matchBottom)).toBe(false);
    expect(samePoint(corner, matchTop)).toBe(false);
  });

  it('lists the corners and match sides on a layer', () => {
    const project = movePoint(withMatch, corner, { x: 7, y: 7 });
    expect(pointsOnLayer(project, 'top')).toEqual([
      { ref: corner, px: { x: 7, y: 7 } },
      { ref: matchTop, px: { x: 1, y: 2 } },
    ]);
    expect(pointsOnLayer(project, 'inner1')).toEqual([]);
  });
});
