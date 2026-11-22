import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { addFeature } from '../commands/features';
import { addLandmarkFromVias } from '../commands/landmarks';
import { setLayerImage } from '../commands/command';
import { distance } from '../geometry/distance';
import type { Vec2 } from '../geometry/vec2';
import type { Via } from '../model/features';
import { via, withFeatures } from '../model/features.test-support';
import { createProject, type Project } from '../model/project';
import { boardToImage, imageToBoard, solveAlignment } from './alignment';
import {
  BOTTOM_TRUTH,
  FEATURES,
  alignedTopProject,
  photo,
  pixelOf,
  run,
} from './fixtures.test-support';
import {
  LANDMARK_MIN_OFFSET_MM,
  findLandmark,
  landmarkPixels,
  viasOverlap,
  type LandmarkOffer,
} from './landmarks';

const at = (x: number, y = 0): Vec2 => ({ x, y });
/** Two vias with the default 0.6 mm pads overlap while their centres are under 0.6 mm apart. */
const pair = (d: number) => viasOverlap(via('a', at(0)), via('b', at(d)));

const withVias = (project: Project, vias: readonly Via[]): Project =>
  run(
    project,
    vias.map((v) => addFeature(v)),
  );

const bothPhotos = (): Project =>
  run(createProject(), [setLayerImage('top', photo('t')), setLayerImage('bottom', photo('b'))]);

describe('landmarks: the overlap rule', () => {
  it('needs the centres closer than the sum of the radii', () => {
    expect(pair(0.59)).toBe(true);
    expect(pair(0.6)).toBe(false);
    const big = { ...via('b', at(11)), padMm: 1.5 };
    expect(viasOverlap(via('a', at(10)), big)).toBe(true);
  });

  it('needs the centres at least 0.05 mm apart, since coinciding vias carry no information', () => {
    expect(LANDMARK_MIN_OFFSET_MM).toBe(0.05);
    expect(pair(0.05)).toBe(true);
    expect(pair(0.049)).toBe(false);
    expect(pair(0)).toBe(false);
  });
});

describe('landmarks: finding the offer', () => {
  const placed = via('new', at(10.3, 10));
  const project = withVias(bothPhotos(), [via('far', at(10, 10)), via('near', at(10.4, 10))]);

  it('offers the nearest overlapping via, with the layers the pixels come from', () => {
    expect(findLandmark(project, { via: placed, activeLayerId: 'bottom' })).toEqual({
      newViaId: 'new',
      existingViaId: 'near',
      at: at(10.4, 10),
      activeLayerId: 'bottom',
      otherLayerId: 'top',
    });
    const top = findLandmark(project, { via: placed, activeLayerId: 'top' });
    expect(top).toMatchObject({ activeLayerId: 'top', otherLayerId: 'bottom' });
  });

  it('offers nothing without an overlapping via, or for the via itself', () => {
    const alone = withVias(bothPhotos(), [via('far', at(20, 10))]);
    expect(findLandmark(alone, { via: placed, activeLayerId: 'top' })).toBeNull();
    const itself = withVias(bothPhotos(), [placed]);
    expect(findLandmark(itself, { via: placed, activeLayerId: 'top' })).toBeNull();
  });

  it('offers nothing unless the active layer and another layer both have a photo', () => {
    const vias = [via('near', at(10.4, 10))];
    const topOnly = withVias(run(createProject(), [setLayerImage('top', photo('t'))]), vias);
    expect(findLandmark(topOnly, { via: placed, activeLayerId: 'top' })).toBeNull();
    expect(findLandmark(topOnly, { via: placed, activeLayerId: 'bottom' })).toBeNull();
    expect(
      findLandmark(withVias(createProject(), vias), { via: placed, activeLayerId: 'top' }),
    ).toBeNull();
  });
});

describe('landmarks: image pixels', () => {
  const project = withVias(alignedTopProject(), [via('old', at(40, 25)), via('new', at(40.3, 25))]);
  const offer: LandmarkOffer = {
    newViaId: 'new',
    existingViaId: 'old',
    at: at(40, 25),
    activeLayerId: 'bottom',
    otherLayerId: 'top',
  };

  it('maps the existing via through the other layer and the new via through the active one', () => {
    const pixels = landmarkPixels(project, offer);
    expect(pixels?.top).toEqual(boardToImage(project, 'top', at(40, 25)));
    expect(pixels?.bottom).toEqual(boardToImage(project, 'bottom', at(40.3, 25)));
    expect(Object.keys(pixels ?? {})).toEqual(['top', 'bottom']);
  });

  it('gives nothing when a via of the offer is gone or a photo is missing', () => {
    const onlyOld = withFeatures([via('old', at(40, 25))]);
    expect(landmarkPixels({ ...project, features: onlyOld.features }, offer)).toBeNull();
    expect(landmarkPixels(project, { ...offer, existingViaId: 'gone' })).toBeNull();
    expect(landmarkPixels({ ...project, layers: createProject().layers }, offer)).toBeNull();
  });
});

/** Board positions of 6 vias spread over the board, each moved by up to 3 mm. */
const viaPositions = fc
  .array(
    fc.record({
      dx: fc.double({ min: -3, max: 3, noNaN: true }),
      dy: fc.double({ min: -3, max: 3, noNaN: true }),
    }),
    {
      minLength: FEATURES.length,
      maxLength: FEATURES.length,
    },
  )
  .map((jitter) =>
    FEATURES.map((p, i) => ({ x: p.x + (jitter[i]?.dx ?? 0), y: p.y + (jitter[i]?.dy ?? 0) })),
  );

/**
 * A via placed exactly on the hole in the top photo, then a second one where the same hole shows
 * on the bottom photo through the bottom's current (possibly wrong) transform, accepted.
 */
function acceptPerfectPair(project: Project, p: Vec2, i: number): Project {
  const shown = imageToBoard(project, 'bottom', pixelOf(BOTTOM_TRUTH, p)) ?? p;
  const vias = [via(`top${String(i)}`, p), via(`bottom${String(i)}`, shown)];
  const offer: LandmarkOffer = {
    newViaId: `bottom${String(i)}`,
    existingViaId: `top${String(i)}`,
    at: p,
    activeLayerId: 'bottom',
    otherLayerId: 'top',
  };
  return addLandmarkFromVias(offer, `m${String(i)}`).execute(withVias(project, vias));
}

describe('landmarks: property', () => {
  // Every accepted pair re-solves the alignment with its outlier test: slow under coverage
  // instrumentation, so this test gets its own time budget (like the M2 accuracy test).
  it(
    'a landmark from a perfectly aligned via pair has a residual of about 0',
    { timeout: 60_000 },
    () => {
      fc.assert(
        fc.property(viaPositions, (positions) => {
          const aligned = positions.reduce(acceptPerfectPair, alignedTopProject());
          const bottom = solveAlignment(aligned).get('bottom');
          expect(bottom?.status).toBe('aligned');
          expect(bottom?.fits).toHaveLength(positions.length);
          expect(Math.max(...(bottom?.fits ?? []).map((f) => f.residualMm))).toBeLessThan(1e-6);
          positions.forEach((p, i) => {
            const kept = aligned.features.find((f) => f.id === `top${String(i)}`);
            expect(kept?.kind === 'via' ? distance(kept.at, p) : 1).toBe(0);
          });
        }),
        { numRuns: 30 },
      );
    },
  );
});
