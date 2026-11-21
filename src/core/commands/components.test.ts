import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { deriveNets } from '../connectivity/nets';
import { instantiate, nextDesignator } from '../footprints/place';
import { generateFootprint } from '../footprints/library';
import {
  bound,
  free,
  plane,
  square,
  trace,
  twoPadComponent,
  via,
  withFeatures,
} from '../model/features.test-support';
import type { Feature } from '../model/features';
import type { Project } from '../model/project';
import {
  attachInsideToPlane,
  attachToPlane,
  detachAllFromPlane,
  flipComponents,
  oppositeLayer,
  rotateComponents,
} from './components';
import { removeFeatures } from './features';

const featureOf = (project: Project, id: string): Feature | undefined =>
  project.features.find((f) => f.id === id);

describe('component connectivity', () => {
  it("keeps a component's pads in separate nets until wired", () => {
    const c = twoPadComponent('c', { x: 0, y: 0 });
    const nets = deriveNets(withFeatures([c]));
    expect(nets.nets.map((n) => n.anchors)).toEqual([['c.1'], ['c.2']]);
    expect(nets.netOfFeature('c')).toBeUndefined();
  });

  it('joins pads of two components through a trace', () => {
    const a = twoPadComponent('a', { x: 0, y: 0 });
    const b = twoPadComponent('b', { x: 10, y: 0 });
    const t = trace('t', [bound('t1', 'a.2'), bound('t2', 'b.1')]);
    const nets = deriveNets(withFeatures([a, b, t]));
    expect(nets.netOfAnchor('a.2')).toBe(nets.netOfAnchor('b.1'));
    expect(nets.netOfAnchor('a.1')).not.toBe(nets.netOfAnchor('b.1'));
    expect(nets.nets).toHaveLength(3);
  });
});

describe('rotating and flipping components', () => {
  it('rotates selected components; a tied trace end follows its pad', () => {
    const c = twoPadComponent('c', { x: 0, y: 0 });
    const t = trace('t', [bound('t1', 'c.2'), free('t2', { x: 5, y: 5 })]);
    const project = rotateComponents(['c'], 90).execute(withFeatures([c, t]));
    expect(featureOf(project, 'c')).toMatchObject({ rotationDeg: 90 });
    expect(featureOf(project, 't')).toEqual(t);
    expect(rotateComponents(['t'], 90).execute(project)).toBe(project);
  });

  it('flipping twice gives back the same component', () => {
    fc.assert(
      fc.property(fc.constantFrom(0, 90, 180, 270), (rotationDeg) => {
        const c = twoPadComponent('c', { x: 3, y: 4 }, { rotationDeg });
        const project = withFeatures([c]);
        const twice = flipComponents(['c']).execute(flipComponents(['c']).execute(project));
        expect(featureOf(twice, 'c')).toEqual(c);
      }),
    );
  });

  it('moves to the other layer mirrored and releases ties from the old side', () => {
    const c = twoPadComponent('c', { x: 0, y: 0 });
    const t = trace('t', [bound('t1', 'c.1'), free('t2', { x: -5, y: 0 })]);
    const p = plane('p', square(-10, -10, 20), ['c.1', 'c.2']);
    const project = flipComponents(['c']).execute(withFeatures([c, t, p]));
    expect(featureOf(project, 'c')).toMatchObject({ layerId: 'bottom', flipped: true });
    expect(featureOf(project, 't')).toMatchObject({
      vertices: [free('t1', { x: -1, y: 0 }), free('t2', { x: -5, y: 0 })],
    });
    expect(featureOf(project, 'p')).toMatchObject({ attached: [] });
  });

  it('keeps ties to through-hole pads, and ignores unknown ids or a board with one side', () => {
    const c = twoPadComponent('c', { x: 0, y: 0 }, { drillMm: 0.8 });
    const t = trace('t', [bound('t1', 'c.1'), free('t2', { x: -5, y: 0 })]);
    const project = flipComponents(['c']).execute(withFeatures([c, t]));
    expect(featureOf(project, 't')).toEqual(t);
    const base = withFeatures([c]);
    expect(flipComponents(['nope']).execute(base)).toBe(base);
    const oneSided = { ...base, layers: base.layers.slice(0, 1) };
    expect(flipComponents(['c']).execute(oneSided)).toBe(oneSided);
    expect(oppositeLayer(base, 'bottom')).toBe('top');
  });
});

describe('planes', () => {
  const board = (): Project =>
    withFeatures([
      via('v1', { x: 2, y: 2 }),
      via('v2', { x: 30, y: 30 }),
      twoPadComponent('c', { x: 5, y: 5 }),
      twoPadComponent('b', { x: 6, y: 6 }, { layerId: 'bottom', flipped: true }),
      trace('t', [free('t1', { x: 3, y: 3 }), free('t2', { x: 4, y: 4 })]),
      plane('p', square(0, 0, 10)),
    ]);

  it('attaches anchors inside the outline on its layer, not trace vertices or the other side', () => {
    const project = attachInsideToPlane('p').execute(board());
    expect(featureOf(project, 'p')).toMatchObject({ attached: ['v1', 'c.1', 'c.2'] });
    const nets = deriveNets(project);
    expect(nets.netOfAnchor('v1')).toBe(nets.netOfAnchor('c.2'));
    expect(nets.netOfFeature('p')).toBe(nets.netOfAnchor('v1'));
  });

  it('attaches selected anchors it can reach, once, and detaches all', () => {
    const attached = attachToPlane('p', ['v2', 'v2', 'b.1', 't1']).execute(board());
    expect(featureOf(attached, 'p')).toMatchObject({ attached: ['v2'] });
    expect(featureOf(detachAllFromPlane('p').execute(attached), 'p')).toMatchObject({
      attached: [],
    });
    expect(deriveNets(board()).netOfFeature('p')).toBeUndefined();
  });

  it('drops attachments of deleted features', () => {
    const project = removeFeatures(['c']).execute(attachInsideToPlane('p').execute(board()));
    expect(featureOf(project, 'p')).toMatchObject({ attached: ['v1'] });
  });

  it('attaching anchors never increases the number of nets', () => {
    const vias = Array.from({ length: 8 }, (_, i) => via(`v${String(i)}`, { x: i, y: i }));
    const base = withFeatures([...vias, plane('p', square(-1, -1, 20))]);
    fc.assert(
      fc.property(fc.subarray(vias.map((v) => v.id)), (ids) => {
        const before = deriveNets(base).nets.length;
        expect(deriveNets(attachToPlane('p', ids).execute(base)).nets.length).toBeLessThanOrEqual(
          before,
        );
      }),
    );
  });
});

describe('placing footprints', () => {
  it('copies pads with fresh ids and the outline', () => {
    const footprint = generateFootprint('pin-header', { rows: '2', pins: 2 });
    if (!footprint.ok) {
      throw new Error('footprint');
    }
    let n = 0;
    const c = instantiate(footprint.value, {
      id: 'j',
      at: { x: 1, y: 1 },
      layerId: 'top',
      flipped: false,
      rotationDeg: 0,
      designator: 'J1',
      value: '',
      ref: { id: 'pin-header', name: footprint.value.name, params: { rows: '2', pins: 2 } },
      newId: () => `id${String(++n)}`,
    });
    expect(c.pads.map((p) => [p.id, p.number])).toEqual([
      ['id1', '1'],
      ['id2', '2'],
      ['id3', '3'],
      ['id4', '4'],
    ]);
    expect(c.outline).toBe(footprint.value.outline);
  });

  it('numbers designators after the highest in use for the prefix', () => {
    const r = (designator: string) => ({
      ...twoPadComponent(designator, { x: 0, y: 0 }),
      designator,
    });
    const project = withFeatures([r('R1'), r('R7'), r('C3'), r('R2x')]);
    expect(nextDesignator(project, 'R')).toBe('R8');
    expect(nextDesignator(project, 'U')).toBe('U1');
    expect(nextDesignator(project, 'C+')).toBe('C+1');
  });
});
