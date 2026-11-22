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
import { activate } from '../tools/registry';
import { DEFAULT_SETTINGS } from '../tools/settings';
import type { AlignState } from '../tools/align';
import type { ViewState } from '../core/view/viewState';
import { buildScene } from './scene';
import { netColor } from '../core/connectivity/netColors';
import { bound, hole, smdPad, trace, via, withFeatures } from '../core/model/features.test-support';
import { NO_NET_COLOR } from './featureScene';

/** The old test shape: align state or null (select tool). */
const sceneOf = (input: { project: Project; view: ViewState; align: AlignState | null }) =>
  buildScene({
    project: input.project,
    view: input.view,
    tool: input.align === null ? activate('select') : { id: 'align', state: input.align },
    selection: [],
    settings: DEFAULT_SETTINGS,
  });

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
  sceneOf({ project, view, align: null }).layers.map((l) => [l.imageId, l.opacity]);

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
    const scene = sceneOf({
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
    const scene = sceneOf({ project, view: view(project), align: INITIAL_ALIGN });
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
    expect(sceneOf({ project, view: view(project), align: null }).markers).toEqual([]);
    expect(
      sceneOf({ project: createProject(), view: view(project), align: null }).outline,
    ).toBeNull();
  });

  it('marks unused match sides, outliers and the pending click', () => {
    const clicks = FEATURES.map((f, i) =>
      matchAt(`m${String(i)}`, f, i === 4 ? { x: 60, y: -40 } : { x: 0, y: 0 }),
    );
    const project = run(alignedTopProject(), clicks);
    const onTop = sceneOf({ project, view: view(project), align: INITIAL_ALIGN }).markers;
    expect(onTop.filter((m) => m.status === 'unused')).toHaveLength(6);
    const bottomView = { ...view(project), activeLayerId: 'bottom' };
    const onBottom = sceneOf({ project, view: bottomView, align: INITIAL_ALIGN }).markers;
    expect(onBottom.filter((m) => m.status === 'outlier').map((m) => m.label)).toEqual(['5']);
    const pending = { ...INITIAL_ALIGN, pending: { layerId: 'bottom', px: { x: 100, y: 100 } } };
    const withPending = sceneOf({ project, view: bottomView, align: pending }).markers;
    expect(withPending.at(-1)).toMatchObject({ label: '?', status: 'pending' });
    expect(sceneOf({ project, view: view(project), align: pending }).markers).toHaveLength(
      onTop.length,
    );
  });

  it('previews a dragged point', () => {
    const project = alignedTopProject();
    const ref = { kind: 'corner', layerId: 'top', corner: 'tl' } as const;
    const drag = { ref, px: { x: 0, y: 0 }, start: { x: 0, y: 0 }, toImage: () => null };
    const dragged = sceneOf({ project, view: view(project), align: { ...INITIAL_ALIGN, drag } });
    const still = sceneOf({ project, view: view(project), align: INITIAL_ALIGN });
    expect(dragged.layers[0]?.imageToBoard).not.toEqual(still.layers[0]?.imageToBoard);
  });
});

describe('buildScene features', () => {
  const board = withFeatures([
    smdPad('p1', { x: 0, y: 0 }),
    smdPad('p2', { x: 5, y: 0 }),
    via('v1', { x: 10, y: 0 }),
    trace('t1', [bound('a', 'p1'), bound('b', 'v1')]),
    smdPad('pb', { x: 3, y: 3 }, 'bottom'),
    hole('h', { x: 20, y: 0 }, false),
  ]);
  const input = (overrides: Partial<Parameters<typeof buildScene>[0]> = {}) => ({
    project: board,
    view: createViewState(board),
    tool: activate('select'),
    selection: [],
    settings: DEFAULT_SETTINGS,
    ...overrides,
  });

  it('colours connected features alike, dims other-layer features and draws them first', () => {
    const scene = buildScene(input());
    const of = (id: string) => {
      const d = scene.features.find((x) => x.feature.id === id);
      if (d === undefined) {
        throw new Error(`no drawable for ${id}`);
      }
      return d;
    };
    expect(of('t1').color).toBe(netColor('p1'));
    expect(of('v1').color).toBe(of('p1').color);
    expect(of('p2').color).not.toBe(of('p1').color);
    expect(of('h').color).toBe(NO_NET_COLOR);
    expect(scene.features.map((d) => [d.feature.id, d.dimmed])[0]).toEqual(['pb', true]);
    expect(of('t1').points).toEqual([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
    ]);
  });

  it('reuses the feature list while nothing changed and rebuilds after a layer switch', () => {
    const first = buildScene(input()).features;
    expect(buildScene(input()).features).toBe(first);
    const bottom = setActiveLayer(createViewState(board), board, 'bottom');
    expect(buildScene(input({ view: bottom })).features).not.toBe(first);
  });

  it('outlines the selection and shows what the tool is doing', () => {
    const scene = buildScene(input({ selection: ['v1'] }));
    expect(scene.selection).toEqual([{ minX: 9.7, minY: -0.3, maxX: 10.3, maxY: 0.3 }]);
    const viaTool = {
      id: 'via',
      state: { cursor: { x: 1, y: 1 }, drag: null, armed: false },
    } as const;
    const known = { ...DEFAULT_SETTINGS, viaSizeKnown: true };
    expect(buildScene(input({ tool: viaTool, settings: known })).toolOverlay.ghost).toMatchObject({
      kind: 'via',
    });
    const moving = {
      id: 'select',
      state: { mode: 'moving', start: { x: 10, y: 0 }, ids: ['v1'], delta: { x: 1, y: 0 } },
    } as const;
    const preview = buildScene(input({ tool: moving })).features.find((d) => d.feature.id === 'v1');
    expect(preview?.feature).toMatchObject({ at: { x: 11, y: 0 } });
  });
});
