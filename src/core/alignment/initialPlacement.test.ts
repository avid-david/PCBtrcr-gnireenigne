import { describe, expect, it } from 'vitest';
import { apply } from '../geometry/mat3';
import { setBoardSize, setLayerImage } from '../commands/command';
import { createProject } from '../model/project';
import { layerBounds, projectBounds } from './bounds';
import { NOMINAL_IMAGE_WIDTH_MM, unalignedTransform } from './initialPlacement';
import { photo, run } from './fixtures.test-support';

const image = photo('img', 2000, 1000);

describe('unaligned placement', () => {
  it('scales the photo to the nominal width without a board', () => {
    const m = unalignedTransform(image, { mirrored: false, board: null });
    expect(apply(m, { x: 0, y: 0 })).toEqual({ x: 0, y: 0 });
    expect(apply(m, { x: 2000, y: 1000 })).toEqual({ x: NOMINAL_IMAGE_WIDTH_MM, y: 50 });
  });

  it('scales the photo to the board width once it is known', () => {
    const m = unalignedTransform(image, { mirrored: false, board: { widthMm: 60, heightMm: 40 } });
    expect(apply(m, { x: 2000, y: 1000 })).toEqual({ x: 60, y: 30 });
  });

  it('mirrors horizontally in place, as part of the transform', () => {
    const m = unalignedTransform(image, { mirrored: true, board: null });
    expect(apply(m, { x: 0, y: 0 })).toEqual({ x: NOMINAL_IMAGE_WIDTH_MM, y: 0 });
    expect(apply(m, { x: 2000, y: 1000 })).toEqual({ x: 0, y: 50 });
  });
});

describe('bounds', () => {
  it('covers photos, ignores layers without photo and is null when empty', () => {
    expect(projectBounds(createProject())).toBeNull();
    expect(layerBounds(createProject(), 'top')).toBeNull();
    const project = run(createProject(), [
      setLayerImage('top', image),
      setLayerImage('bottom', photo('tall', 1000, 2000)),
    ]);
    expect(layerBounds(project, 'top')).toEqual({ minX: 0, minY: 0, maxX: 100, maxY: 50 });
    expect(projectBounds(project)).toEqual({ minX: 0, minY: 0, maxX: 100, maxY: 200 });
  });

  it('includes the board outline', () => {
    const project = run(createProject(), [setBoardSize({ widthMm: 120, heightMm: 300 })]);
    expect(projectBounds(project)).toEqual({ minX: 0, minY: 0, maxX: 120, maxY: 300 });
  });
});
