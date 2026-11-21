import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { Feature } from '../model/features';
import {
  bound,
  free,
  hole,
  smdPad,
  thPad,
  trace,
  via,
  withFeatures,
} from '../model/features.test-support';
import { netColor } from './netColors';
import { deriveNets } from './nets';
import { UnionFind } from './unionFind';

/** A small two-sided board: top pad → via → bottom pad is one net; p2 stands alone. */
const board = withFeatures([
  smdPad('p1', { x: 0, y: 0 }),
  smdPad('p2', { x: 10, y: 0 }),
  via('v1', { x: 5, y: 5 }),
  smdPad('p3', { x: 5, y: 10 }, 'bottom'),
  trace('t1', [bound('a', 'p1'), free('b', { x: 2, y: 3 }), bound('c', 'v1')]),
  trace('t2', [bound('d', 'v1'), bound('e', 'p3')], 'bottom'),
  hole('h', { x: 20, y: 20 }, false),
]);

describe('deriveNets', () => {
  it('connects through traces and vias across layers; names nets by their oldest anchor', () => {
    const nets = deriveNets(board);
    expect(nets.nets.map((n) => [n.id, n.number, n.anchors.length])).toEqual([
      ['p1', 1, 8],
      ['p2', 2, 1],
    ]);
    expect(nets.netOfFeature('p3')?.id).toBe('p1');
    expect(nets.netOfFeature('t2')?.id).toBe('p1');
    expect(nets.netOfAnchor('b')?.id).toBe('p1');
    expect(nets.netOfFeature('h')).toBeUndefined();
    expect(deriveNets(board)).toBe(nets);
  });

  it('through-hole pads and plated holes join both layers too', () => {
    const project = withFeatures([
      thPad('th', { x: 0, y: 0 }),
      hole('ph', { x: 9, y: 9 }, true),
      trace('top', [bound('a', 'th'), bound('b', 'ph')]),
      smdPad('bp', { x: 3, y: 3 }, 'bottom'),
      trace('bot', [bound('c', 'ph'), bound('d', 'bp')], 'bottom'),
    ]);
    expect(deriveNets(project).nets).toHaveLength(1);
  });

  it('is empty for an empty project', () => {
    expect(deriveNets(withFeatures([])).nets).toEqual([]);
  });
});

/** Random boards: pads on a grid and traces between random pairs of existing anchors. */
const randomBoard = fc
  .tuple(fc.integer({ min: 1, max: 12 }), fc.array(fc.tuple(fc.nat(), fc.nat()), { maxLength: 12 }))
  .map(([padCount, links]) => {
    const pads: Feature[] = Array.from({ length: padCount }, (_, i) =>
      i % 3 === 0 ? via(`v${String(i)}`, { x: i, y: 0 }) : smdPad(`p${String(i)}`, { x: i, y: 0 }),
    );
    const ids = pads.map((p) => p.id);
    const traces = links.map(([a, b], i) =>
      trace(`t${String(i)}`, [
        bound(`t${String(i)}a`, ids[a % ids.length] ?? ''),
        bound(`t${String(i)}b`, ids[b % ids.length] ?? ''),
      ]),
    );
    return [...pads, ...traces];
  });

const partition = (features: Feature[]) =>
  deriveNets(withFeatures(features))
    .nets.map((n) => [...n.anchors].sort().join(','))
    .sort();

describe('connectivity properties', () => {
  it('adding a connection never increases the number of nets', () => {
    fc.assert(
      fc.property(randomBoard, fc.nat(), fc.nat(), (features, a, b) => {
        const anchors = features.filter((f) => f.kind !== 'trace').map((f) => f.id);
        const before = deriveNets(withFeatures(features)).nets.length;
        const link = trace('extra', [
          bound('xa', anchors[a % anchors.length] ?? ''),
          bound('xb', anchors[b % anchors.length] ?? ''),
        ]);
        // The new trace's own two vertices join existing nets, so the count cannot grow.
        return deriveNets(withFeatures([...features, link])).nets.length <= before;
      }),
    );
  });

  it('which anchors share a net does not depend on drawing order', () => {
    fc.assert(
      fc.property(
        randomBoard,
        (features) =>
          partition(features).join('|') === partition([...features].reverse()).join('|'),
      ),
    );
  });
});

describe('UnionFind', () => {
  it('merges sets and ignores repeated unions', () => {
    const sets = new UnionFind();
    sets.union('a', 'b');
    sets.union('c', 'd');
    sets.union('b', 'd');
    sets.union('a', 'c');
    expect(sets.find('a')).toBe(sets.find('d'));
    expect(sets.find('e')).toBe('e');
  });
});

describe('netColor', () => {
  it('is stable per net id and spreads hues between ids', () => {
    expect(netColor('p1')).toBe(netColor('p1'));
    const colors = new Set(['a', 'b', 'c', 'd', 'e', 'f'].map(netColor));
    expect(colors.size).toBe(6);
    expect([...colors].every((c) => c >= 0 && c <= 0xffffff)).toBe(true);
  });
});
