import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { boardToImage, solveAlignment } from '../alignment/alignment';
import { alignedTopProject, run } from '../alignment/fixtures.test-support';
import type { LandmarkOffer } from '../alignment/landmarks';
import { via } from '../model/features.test-support';
import type { Project } from '../model/project';
import { addFeature } from './features';
import { EMPTY_HISTORY, execute, undo } from './history';
import { addLandmarkFromVias } from './landmarks';

const offer: LandmarkOffer = {
  newViaId: 'new',
  existingViaId: 'old',
  at: { x: 40, y: 25 },
  activeLayerId: 'bottom',
  otherLayerId: 'top',
};

const withPair = (old = { x: 40, y: 25 }, placed = { x: 40.3, y: 25.1 }): Project =>
  run(alignedTopProject(), [addFeature(via('old', old)), addFeature(via('new', placed))]);

describe('addLandmarkFromVias', () => {
  it('removes the new via and adds one matched point; the existing via stays', () => {
    const before = withPair();
    const command = addLandmarkFromVias(offer, 'm1');
    const after = command.execute(before);
    expect(command.label).toBe('Use via as landmark');
    expect(after.features).toEqual([before.features[0]]);
    expect(after.features[0]).toBe(before.features[0]);
    expect(after.matches).toEqual([
      {
        id: 'm1',
        points: {
          top: boardToImage(before, 'top', { x: 40, y: 25 }),
          bottom: boardToImage(before, 'bottom', { x: 40.3, y: 25.1 }),
        },
      },
    ]);
    expect(solveAlignment(after).get('bottom')?.pointCount).toBe(1);
  });

  it('changes nothing when a via of the offer no longer exists', () => {
    const project = alignedTopProject();
    expect(addLandmarkFromVias(offer, 'm1').execute(project)).toBe(project);
  });

  it('undo after accepting restores the exact previous project', () => {
    const position = fc.record({
      x: fc.double({ min: 0, max: 80, noNaN: true }),
      y: fc.double({ min: 0, max: 50, noNaN: true }),
    });
    fc.assert(
      fc.property(position, position, (old, placed) => {
        const before = withPair(old, placed);
        const step = execute(before, EMPTY_HISTORY, addLandmarkFromVias(offer, 'm1'));
        expect(step.project).not.toBe(before);
        expect(undo(step.project, step.history)?.project).toBe(before);
      }),
    );
  });
});
