import { describe, expect, it } from 'vitest';
import { netColor } from '../core/connectivity/netColors';
import {
  bound,
  free,
  plane,
  square,
  trace,
  twoPadComponent,
  via,
  withFeatures,
} from '../core/model/features.test-support';
import type { Feature } from '../core/model/features';
import {
  createViewState,
  setActiveLayer,
  setContentVisible,
  type LayerContent,
} from '../core/view/viewState';
import { featureScene, NO_NET_COLOR } from './featureScene';
import { NOTE_COLOR, SILK_COLOR, textTransform } from './textItems';

const note: Feature = {
  kind: 'text',
  id: 'n',
  layerId: 'top',
  at: { x: 0, y: 20 },
  text: 'check',
  heightMm: 2,
};
const silkText: Feature = {
  kind: 'silkText',
  id: 'st',
  layerId: 'bottom',
  at: { x: 0, y: 30 },
  text: 'REV',
  heightMm: 1,
};
const silkLine: Feature = {
  kind: 'silkLine',
  id: 'sl',
  layerId: 'top',
  points: [
    { x: 0, y: 0 },
    { x: 5, y: 0 },
  ],
  widthMm: 0.15,
};

const board = withFeatures([
  via('v', { x: 10, y: 0 }),
  twoPadComponent('r', { x: 0, y: 0 }),
  trace('t', [bound('t1', 'r.2'), bound('t2', 'v')]),
  plane('p', square(-5, -5, 30), ['v']),
  note,
  silkText,
  silkLine,
]);

const hide = (layerId: string, content: LayerContent) =>
  setContentVisible(createViewState(board), { layerId, content }, false);

const ids = (scene: ReturnType<typeof featureScene>) => scene.drawables.map((d) => d.feature.id);

describe('feature scene', () => {
  it('colours each component pad by its own net and the plane by its attached net', () => {
    const scene = featureScene(board, createViewState(board));
    const r = scene.drawables.find((d) => d.feature.id === 'r');
    // Pad 2 is wired to the via, the oldest anchor of that net, which names it.
    expect(r?.padColors).toEqual([netColor('r.1'), netColor('v')]);
    expect(r?.color).toBe(NO_NET_COLOR);
    expect(scene.drawables.find((d) => d.feature.id === 'p')?.color).toBe(netColor('v'));
  });

  it('draws planes under the rest of their side, inactive layers first', () => {
    expect(ids(featureScene(board, createViewState(board)))).toEqual([
      'st',
      'p',
      'v',
      'r',
      't',
      'n',
      'sl',
    ]);
  });

  it('hides copper, silkscreen and notes per layer', () => {
    expect(ids(featureScene(board, hide('top', 'copper')))).toEqual(['st', 'r', 'n', 'sl']);
    const noSilk = featureScene(board, hide('top', 'silk'));
    expect(ids(noSilk)).not.toContain('sl');
    expect(noSilk.drawables.find((d) => d.feature.id === 'r')?.show).toEqual({
      copper: true,
      print: false,
    });
    expect(noSilk.texts.map((t) => t.key)).toEqual(['st', 'n']);
    expect(ids(featureScene(board, hide('top', 'text')))).not.toContain('n');
  });

  it('lists texts: notes in their colour, designators centred, bottom silkscreen mirrored', () => {
    const texts = featureScene(board, createViewState(board)).texts;
    expect(texts.map((t) => [t.key, t.text, t.color, t.mirrored])).toEqual([
      ['st', 'REV', SILK_COLOR, true],
      ['r', 'R1', SILK_COLOR, false],
      ['n', 'check', NOTE_COLOR, false],
    ]);
    const designator = texts.find((t) => t.key === 'r');
    expect(designator?.heightMm).toBe(0.6);
    expect(designator?.at.x).toBeCloseTo(-0.36);
    expect(texts[0]?.alpha).toBe(0.3);
  });

  it('skips empty designators and mirrors flipped ones', () => {
    const blank = { ...twoPadComponent('b', { x: 0, y: 0 }), designator: '' };
    const flipped = twoPadComponent('f', { x: 0, y: 0 }, { layerId: 'bottom', flipped: true });
    const project = withFeatures([
      blank,
      flipped,
      trace('x', [free('a', { x: 0, y: 0 }), free('b2', { x: 1, y: 0 })]),
    ]);
    const view = setActiveLayer(createViewState(project), project, 'bottom');
    expect(featureScene(project, view).texts.map((t) => [t.key, t.mirrored])).toEqual([
      ['f', true],
    ]);
  });

  it('reuses the result until the project, layer or visibility changes', () => {
    const view = createViewState(board);
    const first = featureScene(board, view);
    expect(featureScene(board, { ...view, hiddenContent: [] })).toBe(first);
    expect(featureScene(board, hide('top', 'copper'))).not.toBe(first);
  });
});

describe('text placement', () => {
  const item = {
    key: 'k',
    text: 'AB',
    at: { x: 10, y: 5 },
    heightMm: 2,
    color: 0,
    alpha: 1,
    mirrored: false,
  };

  it('scales glyphs to the height, and mirrors about the text box', () => {
    expect(textTransform(item, 100, 50)).toEqual({ scaleX: 0.04, scaleY: 0.04, x: 10, y: 5 });
    expect(textTransform({ ...item, mirrored: true }, 100, 50)).toEqual({
      scaleX: -0.04,
      scaleY: 0.04,
      x: 14,
      y: 5,
    });
  });
});
