import { describe, expect, it } from 'vitest';
import { setLayerImage } from '../core/commands/command';
import { createProject, type Project } from '../core/model/project';
import {
  createViewState,
  setActiveLayer,
  setOverlayOpacity,
  setPhotoVisible,
} from '../core/view/viewState';
import { buildScene } from './scene';

const image = (id: string) => ({
  id,
  fileName: `${id}.png`,
  mimeType: 'image/png',
  widthPx: 100,
  heightPx: 50,
});

const bothPhotos: Project = [
  setLayerImage('top', image('t')),
  setLayerImage('bottom', image('b')),
].reduce((p, c) => c.execute(p), createProject());

const order = (project: Project, view = createViewState(project)) =>
  buildScene(project, view).layers.map((l) => [l.imageId, l.opacity]);

describe('buildScene', () => {
  it('is empty without photos', () => {
    expect(order(createProject())).toEqual([]);
  });

  it('draws the active layer opaque at the back and the other over it', () => {
    expect(order(bothPhotos)).toEqual([
      ['t', 1],
      ['b', 0.5],
    ]);
    const bottomActive = setActiveLayer(createViewState(bothPhotos), bothPhotos, 'bottom');
    expect(order(bothPhotos, bottomActive)).toEqual([
      ['b', 1],
      ['t', 0.5],
    ]);
  });

  it('drops the overlay at 0 % opacity and hidden photos', () => {
    const view = createViewState(bothPhotos);
    expect(order(bothPhotos, setOverlayOpacity(view, 0))).toEqual([['t', 1]]);
    expect(order(bothPhotos, setPhotoVisible(view, 'top', false))).toEqual([['b', 0.5]]);
  });

  it('carries the viewport and the mirrored image transform', () => {
    const scene = buildScene(bothPhotos, createViewState(bothPhotos));
    expect(scene.viewport).toEqual(createViewState(bothPhotos).viewport);
    expect(scene.layers[1]?.imageToBoard[0]).toBeLessThan(0);
    expect(scene.layers[0]?.imageToBoard[0]).toBeGreaterThan(0);
  });
});
