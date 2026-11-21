import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { addFeature, removeFeatures } from '../commands/features';
import { execute, undo, EMPTY_HISTORY } from '../commands/history';
import { resetNetStyle, styleNet, withNetStyles } from '../commands/netStyles';
import {
  bound,
  plane,
  square,
  trace,
  twoPadComponent,
  via,
  withFeatures,
} from '../model/features.test-support';
import type { Project } from '../model/project';
import { netColor } from './netColors';
import {
  describeMerges,
  isFeatureLocked,
  netAppearance,
  reconcileNetStyles,
  setNetStyle,
  type MergeReport,
} from './netStyles';
import { deriveNets } from './nets';

const vias = (n: number) =>
  Array.from({ length: n }, (_, i) => via(`v${String(i)}`, { x: i, y: 0 }));
const wire = (id: string, a: string, b: string) =>
  trace(id, [bound(`${id}a`, a), bound(`${id}b`, b)]);

/** Runs a command the way the editor does, reconciling styles in the same step. */
function run(project: Project, command: { label: string; execute: (p: Project) => Project }) {
  const merges: MergeReport[] = [];
  const step = execute(
    project,
    EMPTY_HISTORY,
    withNetStyles(command, (m) => merges.push(...m)),
  );
  return { project: step.project, history: step.history, merges };
}

const appearanceOf = (project: Project, anchor: string) => {
  const net = deriveNets(project).netOfAnchor(anchor);
  if (net === undefined) {
    throw new Error(`no net for ${anchor}`);
  }
  return netAppearance(project, net);
};

describe('net appearance', () => {
  it('is automatic until styled, then shows the name, colour and lock', () => {
    const project = withFeatures(vias(2));
    expect(appearanceOf(project, 'v1')).toEqual({
      name: 'Net 2',
      color: netColor('v1'),
      locked: false,
      styled: false,
    });
    const styled = setNetStyle(project, 'v1', { name: 'GND', color: 0x123456, locked: true });
    expect(appearanceOf(styled, 'v1')).toEqual({
      name: 'GND',
      color: 0x123456,
      locked: true,
      styled: true,
    });
  });

  it('stores a style on the most durable member and removes it once nothing is set', () => {
    const c = twoPadComponent('c', { x: 0, y: 0 });
    const project = withFeatures([via('v', { x: 5, y: 0 }), c, wire('t', 'v', 'c.2')]);
    const named = setNetStyle(project, 'ta', { name: 'OUT' });
    expect(named.netStyles).toEqual([{ anchor: 'c.2', name: 'OUT', color: null, locked: false }]);
    const renamed = setNetStyle(named, 'v', { name: 'SIG' });
    expect(renamed.netStyles).toEqual([{ anchor: 'c.2', name: 'SIG', color: null, locked: false }]);
    expect(resetNetStyle('v').execute(renamed).netStyles).toEqual([]);
    expect(setNetStyle(project, 'nothing', { name: 'X' })).toBe(project);
  });

  it('locks the features touching a locked net', () => {
    const c = twoPadComponent('c', { x: 0, y: 0 });
    const t = wire('t', 'v', 'c.1');
    const p = plane('p', square(-9, -9, 20), ['v']);
    const project = withFeatures([via('v', { x: 5, y: 0 }), c, t, p, via('w', { x: 9, y: 9 })]);
    expect(isFeatureLocked(project, c)).toBe(false);
    const locked = styleNet('v', { locked: true }).execute(project);
    expect(project.features.map((f) => isFeatureLocked(locked, f))).toEqual([
      true,
      true,
      true,
      true,
      false,
    ]);
    expect(styleNet('v', { locked: false }).label).toBe('Unlock net');
    expect(styleNet('v', { name: 'A' }).label).toBe('Edit net');
  });
});

describe('net styles through edits', () => {
  it('keeps the style of the larger net when two styled nets merge, and says so', () => {
    const base = withFeatures([...vias(4), wire('t1', 'v0', 'v1'), wire('t2', 'v1', 'v2')]);
    const styled = setNetStyle(setNetStyle(base, 'v0', { name: 'BIG' }), 'v3', { name: 'SMALL' });
    const { project, merges } = run(styled, addFeature(wire('t3', 'v2', 'v3')));
    expect(project.netStyles.map((s) => s.name)).toEqual(['BIG']);
    expect(merges).toEqual([{ kept: 'BIG', dropped: ['SMALL'] }]);
    expect(describeMerges(merges)).toContain('Joined SMALL into BIG');
    expect(describeMerges([])).toBeNull();
  });

  it('keeps a styled net\x27s style when it joins an unstyled one', () => {
    const base = setNetStyle(withFeatures([...vias(3), wire('t1', 'v0', 'v1')]), 'v2', {
      name: 'VCC',
    });
    const { project, merges } = run(base, addFeature(wire('t2', 'v1', 'v2')));
    expect(appearanceOf(project, 'v0').name).toBe('VCC');
    expect(merges).toEqual([]);
  });

  it('moves a style off a deleted anchor to another member, and drops it with the net', () => {
    const base = setNetStyle(withFeatures([...vias(2), wire('t', 'v0', 'v1')]), 'v0', {
      name: 'N',
    });
    expect(base.netStyles[0]?.anchor).toBe('v0');
    const moved = run(base, removeFeatures(['v0'])).project;
    expect(moved.netStyles).toEqual([{ anchor: 'v1', name: 'N', color: null, locked: false }]);
    const gone = run(
      setNetStyle(withFeatures(vias(1)), 'v0', { name: 'X' }),
      removeFeatures(['v0']),
    );
    expect(gone.project.netStyles).toEqual([]);
  });

  it('returns the same project when styles are unaffected', () => {
    const base = setNetStyle(withFeatures(vias(2)), 'v0', { name: 'A' });
    const after = addFeature(via('v9', { x: 9, y: 9 })).execute(base);
    expect(reconcileNetStyles(base, after).project).toBe(after);
    const plain = withFeatures(vias(1));
    expect(reconcileNetStyles(plain, plain).project).toBe(plain);
  });

  it('undo restores the styles exactly', () => {
    const base = setNetStyle(setNetStyle(withFeatures(vias(2)), 'v0', { name: 'A' }), 'v1', {
      name: 'B',
    });
    const step = run(base, addFeature(wire('t', 'v0', 'v1')));
    expect(step.project.netStyles).toHaveLength(1);
    expect(undo(step.project, step.history)?.project).toBe(base);
  });
});

describe('net style properties', () => {
  const n = 8;
  const styledBoard = fc
    .uniqueArray(fc.integer({ min: 0, max: n - 1 }), { maxLength: n })
    .map((styled) =>
      styled.reduce(
        (p, i) => setNetStyle(p, `v${String(i)}`, { name: `S${String(i)}` }),
        withFeatures(vias(n)),
      ),
    );
  const links = fc.array(fc.tuple(fc.nat(n - 1), fc.nat(n - 1)), { maxLength: 10 });

  const applyLinks = (project: Project, pairs: [number, number][]) =>
    pairs.reduce(
      (p, [a, b], i) =>
        run(p, addFeature(wire(`t${String(i)}`, `v${String(a)}`, `v${String(b)}`))).project,
      project,
    );

  it('any merges leave at most one style per net', () => {
    fc.assert(
      fc.property(styledBoard, links, (project, pairs) => {
        const after = applyLinks(project, pairs);
        const nets = deriveNets(after);
        const styledNets = after.netStyles.map((s) => nets.netOfAnchor(s.anchor)?.id);
        expect(new Set(styledNets).size).toBe(styledNets.length);
      }),
    );
  });

  it('splitting a net never loses its style', () => {
    fc.assert(
      fc.property(links, fc.nat(9), (pairs, cut) => {
        const joined = applyLinks(
          setNetStyle(withFeatures(vias(n)), 'v0', { name: 'KEEP' }),
          pairs,
        );
        const name = appearanceOf(joined, 'v0').name;
        const traces = joined.features.filter((f) => f.kind === 'trace');
        const victim = traces[cut % Math.max(1, traces.length)];
        const split =
          victim === undefined ? joined : run(joined, removeFeatures([victim.id])).project;
        expect(split.netStyles.some((s) => s.name === name)).toBe(true);
      }),
    );
  });
});
