import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { point } from '../geometry/arbitraries.test-support';
import { pointInPolygon, polygonDistance, polylineDistance } from '../geometry/polygon';
import { anchorsOf } from './anchors';
import {
  componentBounds,
  componentDistance,
  padPolygon,
  normalizeAngle,
  rotateComponent,
  toBoard,
  toLocal,
} from './component';
import { featureBounds, featureDistance, featureOnLayer, translateFeature } from './featureKinds';
import { plane, square, twoPadComponent, withFeatures } from './features.test-support';
import { textBox } from './text';

const angle = fc.double({ min: -720, max: 720, noNaN: true });

describe('component frame', () => {
  it('toLocal undoes toBoard for any placement', () => {
    fc.assert(
      fc.property(
        fc.record({ at: point, local: point, rotationDeg: angle, flipped: fc.boolean() }),
        ({ at, local, rotationDeg, flipped }) => {
          const c = twoPadComponent('c', at, { rotationDeg, flipped });
          const back = toLocal(c, toBoard(c, local));
          expect(back.x).toBeCloseTo(local.x, 6);
          expect(back.y).toBeCloseTo(local.y, 6);
        },
      ),
    );
  });

  it('rotates clockwise on screen and mirrors when flipped', () => {
    const turned = twoPadComponent('c', { x: 10, y: 10 }, { rotationDeg: 90 });
    const p = toBoard(turned, { x: 1, y: 0 });
    expect([p.x, p.y].map((v) => Math.round(v * 1e9) / 1e9)).toEqual([10, 11]);
    const flipped = twoPadComponent('c', { x: 10, y: 10 }, { flipped: true });
    expect(toBoard(flipped, { x: 1, y: 0 })).toEqual({ x: 9, y: 10 });
  });

  it('turning four quarter turns gives back the same component', () => {
    fc.assert(
      fc.property(angle, (rotationDeg) => {
        const c = twoPadComponent(
          'c',
          { x: 0, y: 0 },
          { rotationDeg: normalizeAngle(rotationDeg) },
        );
        const turned = [90, 90, 90, 90].reduce(rotateComponent, c);
        expect(turned.rotationDeg).toBeCloseTo(c.rotationDeg, 6);
      }),
    );
    expect(normalizeAngle(-90)).toBe(270);
    expect(Object.is(normalizeAngle(-0), 0)).toBe(true);
  });

  it('measures distance to its body and pads, and bounds on the board', () => {
    const c = twoPadComponent('c', { x: 10, y: 10 }, { rotationDeg: 90 });
    expect(componentDistance(c, { x: 10, y: 10 })).toBe(0);
    expect(componentDistance(c, { x: 10, y: 15 })).toBeCloseTo(3.5);
    const b = componentBounds(c);
    expect([b.minX, b.maxX, b.minY, b.maxY].map((v) => Math.round(v * 10) / 10)).toEqual([
      9.3, 10.7, 8.5, 11.5,
    ]);
  });

  it('is on its own layer only, and moves by its origin', () => {
    const c = twoPadComponent('c', { x: 0, y: 0 });
    expect(featureOnLayer(c, 'top')).toBe(true);
    expect(featureOnLayer(c, 'bottom')).toBe(false);
    expect(translateFeature(c, { x: 1, y: 2 })).toMatchObject({ at: { x: 1, y: 2 } });
  });

  it('offers each pad as an anchor: SMD on its layer, through-hole on every layer', () => {
    const smd = twoPadComponent('c', { x: 5, y: 0 });
    expect(anchorsOf(smd).map((a) => [a.id, a.layerId, a.at])).toEqual([
      ['c.1', 'top', { x: 4, y: 0 }],
      ['c.2', 'top', { x: 6, y: 0 }],
    ]);
    const th = twoPadComponent('t', { x: 0, y: 0 }, { drillMm: 0.8 });
    expect(anchorsOf(th).every((a) => a.layerId === null)).toBe(true);
  });
});

describe('planes, text and silkscreen', () => {
  const outline = square(0, 0, 10);

  it('finds points inside a polygon and distances to it', () => {
    expect(pointInPolygon({ x: 5, y: 5 }, outline)).toBe(true);
    expect(pointInPolygon({ x: 15, y: 5 }, outline)).toBe(false);
    expect(polygonDistance({ x: 13, y: 5 }, outline)).toBe(3);
    expect(polylineDistance({ x: 0, y: 3 }, [{ x: 0, y: 0 }])).toBe(3);
    expect(polylineDistance({ x: 0, y: 0 }, [])).toBe(Number.POSITIVE_INFINITY);
  });

  it('gives planes, text and silkscreen bounds, hit distances and moves', () => {
    const project = withFeatures([]);
    const p = plane('p', outline);
    expect(featureBounds(p, project)).toEqual({ minX: 0, minY: 0, maxX: 10, maxY: 10 });
    expect(featureDistance(p, { x: 5, y: 5 }, project)).toBe(0);
    expect(translateFeature(p, { x: 1, y: 0 })).toMatchObject({ outline: square(1, 0, 10) });
    const line = {
      kind: 'silkLine' as const,
      id: 'l',
      layerId: 'top',
      points: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
      ],
      widthMm: 0.2,
    };
    expect(featureDistance(line, { x: 5, y: 1 }, project)).toBeCloseTo(0.9);
    expect(featureBounds(line, project).minY).toBeCloseTo(-0.1);
    expect(translateFeature(line, { x: 0, y: 1 })).toMatchObject({
      points: [
        { x: 0, y: 1 },
        { x: 10, y: 1 },
      ],
    });
    const note = {
      kind: 'text' as const,
      id: 't',
      layerId: 'top',
      at: { x: 0, y: 0 },
      text: 'ab\nc',
      heightMm: 2,
    };
    expect(featureBounds(note, project)).toEqual(textBox(note.at, note.text, 2));
    expect(textBox({ x: 0, y: 0 }, 'ab\nc', 2)).toEqual({ minX: 0, minY: 0, maxX: 2.4, maxY: 4 });
    expect(featureDistance(note, { x: 1, y: 1 }, project)).toBe(0);
    expect(featureOnLayer(note, 'bottom')).toBe(false);
    expect(translateFeature({ ...note, kind: 'silkText' }, { x: 1, y: 1 })).toMatchObject({
      at: { x: 1, y: 1 },
    });
    expect(anchorsOf(note)).toEqual([]);
  });
});

describe('pad polygons', () => {
  const withPad = (shape: 'rect' | 'round' | 'oval', widthMm: number, heightMm: number) => {
    const c = twoPadComponent('c', { x: 10, y: 0 }, { rotationDeg: 90 });
    const pad = {
      ...c.pads[0],
      id: 'p',
      number: '1',
      at: { x: 0, y: 0 },
      shape,
      widthMm,
      heightMm,
      drillMm: 0,
    };
    return padPolygon(c, pad);
  };
  const extent = (points: { x: number; y: number }[]) => {
    const xs = points.map((p) => p.x);
    const ys = points.map((p) => p.y);
    return [Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)].map(
      (v) => Math.round(v * 1e6) / 1e6,
    );
  };

  it('turns pads with their component (a 2 × 1 pad becomes 1 wide, 2 tall at 90°)', () => {
    expect(withPad('rect', 2, 1)).toHaveLength(4);
    expect(extent(withPad('rect', 2, 1))).toEqual([1, 2]);
    expect(extent(withPad('round', 2, 1))).toEqual([1, 2]);
    expect(extent(withPad('oval', 2, 1))).toEqual([1, 2]);
    expect(extent(withPad('oval', 1, 3))).toEqual([3, 1]);
  });
});
