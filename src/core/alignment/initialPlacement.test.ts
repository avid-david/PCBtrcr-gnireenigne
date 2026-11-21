import { describe, expect, it } from 'vitest';
import { apply } from '../geometry/mat3';
import { createProject, updateLayer, type SourceImage } from '../model/project';
import {
  NOMINAL_IMAGE_WIDTH_MM,
  imageToBoard,
  layerBounds,
  projectBounds,
} from './initialPlacement';

const photo: SourceImage = {
  id: 'img',
  fileName: 'top.png',
  mimeType: 'image/png',
  widthPx: 2000,
  heightPx: 1000,
};

describe('initial placement', () => {
  it('scales the photo to the nominal width', () => {
    const m = imageToBoard(photo, false);
    expect(apply(m, { x: 0, y: 0 })).toEqual({ x: 0, y: 0 });
    expect(apply(m, { x: 2000, y: 1000 })).toEqual({ x: NOMINAL_IMAGE_WIDTH_MM, y: 50 });
  });

  it('mirrors horizontally in place, as part of the transform', () => {
    const m = imageToBoard(photo, true);
    expect(apply(m, { x: 0, y: 0 })).toEqual({ x: NOMINAL_IMAGE_WIDTH_MM, y: 0 });
    expect(apply(m, { x: 2000, y: 1000 })).toEqual({ x: 0, y: 50 });
  });

  it('mirroring does not change the bounds', () => {
    const project = updateLayer(createProject(), 'top', (l) => ({ ...l, image: photo }));
    const top = project.layers[0];
    expect(top && layerBounds(top)).toEqual({ minX: 0, minY: 0, maxX: 100, maxY: 50 });
    expect(top && layerBounds({ ...top, mirrored: true })).toEqual(top && layerBounds(top));
  });

  it('project bounds cover all photos and are null without photos', () => {
    expect(projectBounds(createProject())).toBeNull();
    const tall = { ...photo, id: 'b', widthPx: 1000, heightPx: 2000 };
    const project = updateLayer(
      updateLayer(createProject(), 'top', (l) => ({ ...l, image: photo })),
      'bottom',
      (l) => ({ ...l, image: tall }),
    );
    expect(projectBounds(project)).toEqual({ minX: 0, minY: 0, maxX: 100, maxY: 200 });
  });
});
