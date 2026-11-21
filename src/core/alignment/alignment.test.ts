import { describe, expect, it } from 'vitest';
import { setBoardSize, setLayerImage } from '../commands/command';
import { closeTo } from '../geometry/arbitraries.test-support';
import { apply } from '../geometry/mat3';
import { cornerPosition, createProject } from '../model/project';
import {
  boardToImage,
  imageToBoard,
  layerTransform,
  solveAlignment,
  type LayerAlignment,
} from './alignment';
import {
  BOTTOM_TRUTH,
  FEATURES,
  TOP_TRUTH,
  alignedTopProject,
  board,
  cornerClicks,
  matchAt,
  photo,
  pixelOf,
  run,
} from './fixtures.test-support';

const alignmentOf = (project: Parameters<typeof solveAlignment>[0], id: string): LayerAlignment => {
  const a = solveAlignment(project).get(id);
  if (a === undefined) {
    throw new Error(`no alignment for ${id}`);
  }
  return a;
};

describe('alignment', () => {
  it('aligns the top photo exactly from its 4 corners', () => {
    const top = alignmentOf(alignedTopProject(), 'top');
    expect(top.status).toBe('aligned');
    expect(top.pointCount).toBe(4);
    expect(top.rmsMm).toBeLessThan(1e-6);
    const corner = cornerPosition(board, 'br');
    const mapped = imageToBoard(alignedTopProject(), 'top', pixelOf(TOP_TRUTH, corner));
    expect(mapped !== null && closeTo(mapped, corner, 1e-6)).toBe(true);
  });

  it('ignores corners until the board size is known', () => {
    const project = run(createProject(), [
      setLayerImage('top', photo('t')),
      ...cornerClicks('top', TOP_TRUTH),
    ]);
    expect(alignmentOf(project, 'top')).toMatchObject({ status: 'too-few-points', pointCount: 0 });
  });

  it('reports layers without photo', () => {
    expect(alignmentOf(createProject(), 'bottom').status).toBe('no-photo');
    expect(layerTransform(createProject(), 'bottom')).toBeNull();
    expect(boardToImage(createProject(), 'bottom', { x: 0, y: 0 })).toBeNull();
    expect(imageToBoard(createProject(), 'bottom', { x: 0, y: 0 })).toBeNull();
  });

  it('aligns the bottom photo to the top from matched features', () => {
    const project = run(
      alignedTopProject(),
      FEATURES.slice(0, 4).map((f, i) => matchAt(`m${String(i)}`, f)),
    );
    const bottom = alignmentOf(project, 'bottom');
    expect(bottom.status).toBe('aligned');
    const probe = { x: 33, y: 17 };
    const mapped = imageToBoard(project, 'bottom', pixelOf(BOTTOM_TRUTH, probe));
    expect(mapped !== null && closeTo(mapped, probe, 1e-6)).toBe(true);
  });

  it('can align the bottom photo from its own corners', () => {
    const project = run(alignedTopProject(), cornerClicks('bottom', BOTTOM_TRUTH));
    expect(alignmentOf(project, 'bottom').status).toBe('aligned');
  });

  it('needs 4 points and flags none of them as outliers when all are good', () => {
    const three = run(
      alignedTopProject(),
      FEATURES.slice(0, 3).map((f, i) => matchAt(`m${String(i)}`, f)),
    );
    expect(alignmentOf(three, 'bottom')).toMatchObject({ status: 'too-few-points', pointCount: 3 });
    const six = run(
      alignedTopProject(),
      FEATURES.map((f, i) => matchAt(`m${String(i)}`, f)),
    );
    expect(alignmentOf(six, 'bottom').fits.some((fit) => fit.outlier)).toBe(false);
  });

  it('measures residuals in mm and flags a mis-clicked point as outlier', () => {
    const clicks = FEATURES.map((f, i) =>
      matchAt(`m${String(i)}`, f, i === 4 ? { x: 60, y: -40 } : { x: 0, y: 0 }),
    );
    const bottom = alignmentOf(run(alignedTopProject(), clicks), 'bottom');
    const flagged = bottom.fits.filter((fit) => fit.outlier).map((fit) => fit.ref);
    expect(flagged).toEqual([{ kind: 'match', layerId: 'bottom', matchId: 'm4' }]);
    expect(bottom.rmsMm).toBeGreaterThan(0.1);
  });

  it('without alignment, shows the photo at the board width (or 100 mm), mirrored for the bottom', () => {
    const withPhotos = run(createProject(), [setLayerImage('bottom', photo('b', 1000, 500))]);
    const nominal = layerTransform(withPhotos, 'bottom');
    expect(nominal && apply(nominal, { x: 0, y: 0 })).toEqual({ x: 100, y: 0 });
    const sized = run(withPhotos, [setBoardSize(board)]);
    const scaled = layerTransform(sized, 'bottom');
    expect(scaled && apply(scaled, { x: 0, y: 0 })).toEqual({ x: 80, y: 0 });
  });

  it('converts board positions back to image pixels', () => {
    const project = alignedTopProject();
    const px = boardToImage(project, 'top', { x: 20, y: 30 });
    expect(px !== null && closeTo(px, pixelOf(TOP_TRUTH, { x: 20, y: 30 }), 1e-6)).toBe(true);
  });

  it('caches results per project', () => {
    const project = alignedTopProject();
    expect(solveAlignment(project)).toBe(solveAlignment(project));
  });
});
