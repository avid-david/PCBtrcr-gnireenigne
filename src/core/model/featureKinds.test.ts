import { describe, expect, it } from 'vitest';
import { anchorIndex, anchorOnLayer, anchorPosition, anchorsOf, rootAnchor } from './anchors';
import {
  featureBounds,
  featureDistance,
  featureOnLayer,
  onAllLayers,
  tracePoints,
  translateFeature,
} from './featureKinds';
import {
  bound,
  free,
  hole,
  smdPad,
  testPoint,
  thPad,
  trace,
  via,
  withFeatures,
} from './features.test-support';

const board = withFeatures([
  smdPad('p1', { x: 10, y: 10 }),
  via('v1', { x: 20, y: 10 }),
  trace('t1', [bound('t1a', 'p1'), free('t1b', { x: 15, y: 12 }), bound('t1c', 'v1')]),
  hole('h1', { x: 5, y: 5 }, false),
  hole('h2', { x: 6, y: 6 }, true),
  thPad('p2', { x: 30, y: 30 }),
  testPoint('c1', { x: 40, y: 40 }, 'bottom'),
]);

const feature = (id: string) => {
  const f = board.features.find((x) => x.id === id);
  if (f === undefined) {
    throw new Error(id);
  }
  return f;
};

describe('anchors', () => {
  it('lists anchors per kind; mechanical holes have none', () => {
    expect(anchorsOf(feature('t1')).map((a) => a.id)).toEqual(['t1a', 't1b', 't1c']);
    expect(anchorsOf(feature('h1'))).toEqual([]);
    expect(anchorsOf(feature('h2')).map((a) => a.layerId)).toEqual([null]);
    expect(anchorIndex(board).size).toBe(8);
    expect(anchorIndex(board)).toBe(anchorIndex(board));
  });

  it('resolves bound vertices to their anchor position', () => {
    expect(anchorPosition(board, 't1a')).toEqual({ x: 10, y: 10 });
    expect(anchorPosition(board, 't1b')).toEqual({ x: 15, y: 12 });
    expect(anchorPosition(board, 'missing')).toBeNull();
    expect(rootAnchor(board, 't1c')?.id).toBe('v1');
  });

  it('survives binding cycles instead of looping forever', () => {
    const cyclic = withFeatures([trace('t', [bound('a', 'b'), bound('b', 'a')])]);
    expect(rootAnchor(cyclic, 'a')).toBeNull();
  });

  it('knows which layers an anchor reaches', () => {
    const index = anchorIndex(board);
    const pad = index.get('p1');
    const viaAnchor = index.get('v1');
    expect(pad !== undefined && anchorOnLayer(pad, 'bottom')).toBe(false);
    expect(viaAnchor !== undefined && anchorOnLayer(viaAnchor, 'bottom')).toBe(true);
  });
});

describe('feature kinds', () => {
  it('know their layers', () => {
    expect(featureOnLayer(feature('p1'), 'top')).toBe(true);
    expect(featureOnLayer(feature('p1'), 'bottom')).toBe(false);
    expect(featureOnLayer(feature('c1'), 'top')).toBe(false);
    expect(['v1', 'h1', 'p2'].every((id) => onAllLayers(feature(id), board))).toBe(true);
    expect(onAllLayers(feature('t1'), board)).toBe(false);
  });

  it('measure bounds including width', () => {
    expect(featureBounds(feature('p1'), board)).toEqual({
      minX: 9.5,
      minY: 9.7,
      maxX: 10.5,
      maxY: 10.3,
    });
    expect(featureBounds(feature('t1'), board)).toEqual({
      minX: 9.875,
      minY: 9.875,
      maxX: 20.125,
      maxY: 12.125,
    });
    expect(featureBounds(feature('v1'), board)).toEqual({
      minX: 19.7,
      minY: 9.7,
      maxX: 20.3,
      maxY: 10.3,
    });
  });

  it('measure the distance to their copper', () => {
    expect(featureDistance(feature('p1'), { x: 10, y: 10 }, board)).toBe(0);
    expect(featureDistance(feature('p1'), { x: 12.5, y: 10 }, board)).toBeCloseTo(2);
    expect(featureDistance(feature('v1'), { x: 21.3, y: 10 }, board)).toBeCloseTo(1);
    expect(featureDistance(feature('t1'), { x: 12.5, y: 11 }, board)).toBe(0);
    expect(featureDistance(feature('t1'), { x: 15, y: 14 }, board)).toBeCloseTo(1.875);
  });

  it('move; bound trace vertices stay tied to their anchors', () => {
    const moved = translateFeature(feature('t1'), { x: 1, y: 1 });
    const project = { ...board, features: board.features.map((f) => (f.id === 't1' ? moved : f)) };
    expect(moved.kind === 'trace' && tracePoints(moved, project)).toEqual([
      { x: 10, y: 10 },
      { x: 16, y: 13 },
      { x: 20, y: 10 },
    ]);
    expect(translateFeature(feature('p1'), { x: 1, y: 0 })).toMatchObject({ at: { x: 11, y: 10 } });
  });

  it('skip vertices whose anchor is missing and still give bounds', () => {
    const orphan = withFeatures([trace('t', [bound('a', 'gone'), bound('b', 'gone2')])]);
    const t = orphan.features[0];
    expect(t !== undefined && tracePoints(t as never, orphan)).toEqual([]);
    expect(t !== undefined && featureBounds(t, orphan)).toEqual({
      minX: -0.125,
      minY: -0.125,
      maxX: 0.125,
      maxY: 0.125,
    });
  });
});
