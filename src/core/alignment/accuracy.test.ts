import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { addMatch, placePoint, type Command } from '../commands/command';
import { apply, type Mat3 } from '../geometry/mat3';
import type { Vec2 } from '../geometry/vec2';
import { CORNERS, cornerPosition, type LayerId, type Project } from '../model/project';
import { imageToBoard, solveAlignment } from './alignment';
import { rms } from './fit';
import { BOTTOM_TRUTH, FEATURES, TOP_TRUTH, board, photo, run } from './fixtures.test-support';
import { setBoardSize, setLayerImage } from '../commands/command';
import { createProject } from '../model/project';

// M2 acceptance ("align to < 0.2 mm RMS with 6 good points"), with synthetic photos: a known
// perspective per side plus mild barrel distortion a homography cannot model, and every click
// off by up to ±1 px.

const CENTER: Vec2 = { x: 2000, y: 1500 };
/** Radial distortion coefficient: ~3 px displacement at the photo corners (r ≈ 2500 px). */
const K1 = 1.9e-10;

/** Where a board position appears in a distorted photo. */
function distortedPixel(truth: Mat3, boardMm: Vec2): Vec2 {
  const p = apply(truth, boardMm);
  const dx = p.x - CENTER.x;
  const dy = p.y - CENTER.y;
  const f = 1 + K1 * (dx * dx + dy * dy);
  return { x: CENTER.x + dx * f, y: CENTER.y + dy * f };
}

const jitter = fc.record({
  x: fc.double({ min: -1, max: 1, noNaN: true }),
  y: fc.double({ min: -1, max: 1, noNaN: true }),
});
/** Click errors for 4 top corners plus top and bottom sides of 6 matches. */
const clickErrors = fc.array(jitter, { minLength: 16, maxLength: 16 });

const plus = (a: Vec2, b: Vec2 | undefined): Vec2 => ({
  x: a.x + (b?.x ?? 0),
  y: a.y + (b?.y ?? 0),
});

function clickedProject(errors: readonly Vec2[]): Project {
  const corners: Command[] = CORNERS.map((corner, i) =>
    placePoint(
      { kind: 'corner', layerId: 'top', corner },
      plus(distortedPixel(TOP_TRUTH, cornerPosition(board, corner)), errors[i]),
    ),
  );
  const matches: Command[] = FEATURES.map((f, i) =>
    addMatch({
      id: `m${String(i)}`,
      points: {
        top: plus(distortedPixel(TOP_TRUTH, f), errors[4 + i]),
        bottom: plus(distortedPixel(BOTTOM_TRUTH, f), errors[10 + i]),
      },
    }),
  );
  return run(createProject(), [
    setLayerImage('top', photo('t')),
    setLayerImage('bottom', photo('b')),
    setBoardSize(board),
    ...corners,
    ...matches,
  ]);
}

/** A 7 × 5 grid of check positions over the board, independent of the clicked points. */
const CHECKS: Vec2[] = Array.from({ length: 35 }, (_, i) => ({
  x: 5 + (i % 7) * 11.5,
  y: 4 + Math.floor(i / 7) * 10.5,
}));

/** RMS distance in mm between where the alignment puts the check points and where they are. */
function trueErrorMm(project: Project, layerId: LayerId, truth: Mat3): number {
  const errors = CHECKS.map((p) => {
    const mapped = imageToBoard(project, layerId, distortedPixel(truth, p));
    return mapped === null ? Number.POSITIVE_INFINITY : Math.hypot(mapped.x - p.x, mapped.y - p.y);
  });
  return rms(errors);
}

describe('alignment accuracy (M2 acceptance)', () => {
  // 100 random click sets, each with a full alignment solve and outlier test: slow under
  // coverage instrumentation, so this test gets its own time budget.
  it(
    'aligns both photos to < 0.2 mm with 4 corners and 6 matched points',
    { timeout: 60_000 },
    () => {
      fc.assert(
        fc.property(clickErrors, (errors) => {
          const project = clickedProject(errors);
          const bottom = solveAlignment(project).get('bottom');
          return (
            bottom?.status === 'aligned' &&
            (bottom.rmsMm ?? Number.POSITIVE_INFINITY) < 0.2 &&
            bottom.fits.every((fit) => !fit.outlier) &&
            trueErrorMm(project, 'top', TOP_TRUTH) < 0.2 &&
            trueErrorMm(project, 'bottom', BOTTOM_TRUTH) < 0.2
          );
        }),
        { numRuns: 100 },
      );
    },
  );

  it('reports the measured accuracy for one representative set of clicks', () => {
    const project = clickedProject(
      Array.from({ length: 16 }, (_, i) => ({ x: (i % 3) - 1, y: ((i + 1) % 3) - 1 })),
    );
    const bottom = solveAlignment(project).get('bottom');
    expect(bottom?.rmsMm).toBeLessThan(0.2);
    expect(trueErrorMm(project, 'top', TOP_TRUTH)).toBeLessThan(0.2);
    expect(trueErrorMm(project, 'bottom', BOTTOM_TRUTH)).toBeLessThan(0.2);
  });
});
