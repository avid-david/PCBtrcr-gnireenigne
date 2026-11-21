import { describe, expect, it } from 'vitest';
import { getPoint } from '../model/points';
import { createProject, findLayer } from '../model/project';
import {
  addMatch,
  deletePoint,
  placePoint,
  setBoardSize,
  setLayerImage,
  setLayerMirrored,
} from './command';

const image = {
  id: 'i1',
  fileName: 'bottom.jpg',
  mimeType: 'image/jpeg',
  widthPx: 10,
  heightPx: 20,
};

const corner = { kind: 'corner', layerId: 'bottom', corner: 'tl' } as const;
const match = { id: 'm1', points: { top: { x: 1, y: 1 }, bottom: { x: 2, y: 2 } } };

describe('commands', () => {
  it('setLayerImage sets the photo of one layer without mutating the input', () => {
    const project = createProject();
    const command = setLayerImage('bottom', image);
    const next = command.execute(project);
    expect(command.label).toBe('Import bottom.jpg');
    expect(findLayer(next, 'bottom')?.image).toBe(image);
    expect(findLayer(next, 'top')?.image).toBeNull();
    expect(findLayer(project, 'bottom')?.image).toBeNull();
  });

  it('setLayerImage drops points clicked on the replaced photo', () => {
    const before = [placePoint(corner, { x: 1, y: 1 }), addMatch(match)].reduce(
      (p, c) => c.execute(p),
      createProject(),
    );
    const replaced = setLayerImage('bottom', image).execute(before);
    expect(getPoint(replaced, corner)).toBeUndefined();
    expect(replaced.matches).toEqual([]);
    expect(setLayerImage('inner1', image).execute(before).matches).toEqual([match]);
  });

  it('setLayerMirrored toggles the mirror flag', () => {
    const project = createProject();
    const unmirror = setLayerMirrored('bottom', false);
    expect(unmirror.label).toBe('Unmirror photo');
    expect(findLayer(unmirror.execute(project), 'bottom')?.mirrored).toBe(false);
    expect(setLayerMirrored('top', true).label).toBe('Mirror photo');
    expect(findLayer(setLayerMirrored('top', true).execute(project), 'top')?.mirrored).toBe(true);
  });

  it('setBoardSize sets the board', () => {
    const command = setBoardSize({ widthMm: 80, heightMm: 50 });
    expect(command.label).toBe('Set board size 80 × 50 mm');
    expect(command.execute(createProject()).board).toEqual({ widthMm: 80, heightMm: 50 });
  });

  it('places, moves and deletes points', () => {
    const placed = placePoint(corner, { x: 3, y: 4 }).execute(createProject());
    expect(getPoint(placed, corner)).toEqual({ x: 3, y: 4 });
    expect(getPoint(deletePoint(corner).execute(placed), corner)).toBeUndefined();
    expect(placePoint(corner, { x: 0, y: 0 }).label).toBe('Place corner');
    expect(deletePoint(corner).label).toBe('Delete corner');
    const matchRef = { kind: 'match', layerId: 'top', matchId: 'm1' } as const;
    expect(placePoint(matchRef, { x: 0, y: 0 }).label).toBe('Move matched point');
    expect(deletePoint(matchRef).label).toBe('Delete matched point');
  });

  it('addMatch appends a matched feature', () => {
    const command = addMatch(match);
    expect(command.label).toBe('Add matched point');
    expect(command.execute(createProject()).matches).toEqual([match]);
  });
});
