import { describe, expect, it } from 'vitest';
import { setLayerImage } from '../core/commands/command';
import { createProject, type Project } from '../core/model/project';
import {
  createViewState,
  setActiveLayer,
  setOverlayOpacity,
  setPhotoVisible,
} from '../core/view/viewState';
import { FEATURES, alignedTopProject, matchAt, run } from '../core/alignment/fixtures.test-support';
import { INITIAL_ALIGN } from '../tools/align';
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
  buildScene({ project, view, align: null }).layers.map((l) => [l.imageId, l.opacity]);

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
    const scene = buildScene({
      project: bothPhotos,
      view: createViewState(bothPhotos),
      align: null,
    });
    expect(scene.viewport).toEqual(createViewState(bothPhotos).viewport);
    expect(scene.layers[1]?.imageToBoard[0]).toBeLessThan(0);
    expect(scene.layers[0]?.imageToBoard[0]).toBeGreaterThan(0);
  });
});

describe('buildScene in align mode', () => {
  const view = (project: Project) => ({ ...createViewState(project), activeLayerId: 'top' });

  it('draws the board outline and the active layer’s points', () => {
    const project = alignedTopProject();
    const scene = buildScene({ project, view: view(project), align: INITIAL_ALIGN });
    expect(scene.outline).toEqual([
      { x: 0, y: 0 },
      { x: 80, y: 0 },
      { x: 80, y: 50 },
      { x: 0, y: 50 },
    ]);
    expect(scene.markers.map((m) => [m.label, m.status])).toEqual([
      ['TL', 'fitted'],
      ['TR', 'fitted'],
      ['BR', 'fitted'],
      ['BL', 'fitted'],
    ]);
    expect(buildScene({ project, view: view(project), align: null }).markers).toEqual([]);
    expect(
      buildScene({ project: createProject(), view: view(project), align: null }).outline,
    ).toBeNull();
  });

  it('marks unused match sides, outliers and the pending click', () => {
    const clicks = FEATURES.map((f, i) =>
      matchAt(`m${String(i)}`, f, i === 4 ? { x: 60, y: -40 } : { x: 0, y: 0 }),
    );
    const project = run(alignedTopProject(), clicks);
    const onTop = buildScene({ project, view: view(project), align: INITIAL_ALIGN }).markers;
    expect(onTop.filter((m) => m.status === 'unused')).toHaveLength(6);
    const bottomView = { ...view(project), activeLayerId: 'bottom' };
    const onBottom = buildScene({ project, view: bottomView, align: INITIAL_ALIGN }).markers;
    expect(onBottom.filter((m) => m.status === 'outlier').map((m) => m.label)).toEqual(['5']);
    const pending = { ...INITIAL_ALIGN, pending: { layerId: 'bottom', px: { x: 100, y: 100 } } };
    const withPending = buildScene({ project, view: bottomView, align: pending }).markers;
    expect(withPending.at(-1)).toMatchObject({ label: '?', status: 'pending' });
    expect(buildScene({ project, view: view(project), align: pending }).markers).toHaveLength(
      onTop.length,
    );
  });

  it('previews a dragged point', () => {
    const project = alignedTopProject();
    const ref = { kind: 'corner', layerId: 'top', corner: 'tl' } as const;
    const drag = { ref, px: { x: 0, y: 0 }, start: { x: 0, y: 0 }, toImage: () => null };
    const dragged = buildScene({ project, view: view(project), align: { ...INITIAL_ALIGN, drag } });
    const still = buildScene({ project, view: view(project), align: INITIAL_ALIGN });
    expect(dragged.layers[0]?.imageToBoard).not.toEqual(still.layers[0]?.imageToBoard);
  });
});
