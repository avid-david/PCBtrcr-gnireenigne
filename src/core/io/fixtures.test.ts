import { describe, expect, it } from 'vitest';
import { deriveNets } from '../connectivity/nets';
import v1Example from './fixtures/v1-example.json?raw';
import v2Example from './fixtures/v2-example.json?raw';
import v3Example from './fixtures/v3-example.json?raw';
import { netAppearance } from '../connectivity/netStyles';
import { parseProject } from './projectFile';

// Files saved by released versions must keep loading. Add one fixture per schema version
// and never edit an existing one.
describe('released file formats', () => {
  it('loads a version 1 project with every feature kind', () => {
    const result = parseProject(v1Example);
    if (!result.ok) {
      throw new Error(JSON.stringify(result.error));
    }
    const project = result.value;
    expect(project.board).toEqual({ widthMm: 50, heightMm: 30 });
    expect(project.layers.map((l) => l.image?.fileName ?? null)).toEqual(['top.jpg', null]);
    expect(project.features.map((f) => f.kind)).toEqual([
      'via',
      'hole',
      'pad',
      'pad',
      'point',
      'trace',
      'trace',
    ]);
    expect(deriveNets(project).nets.length).toBeGreaterThan(0);
  });

  it('loads a version 2 project with components, a plane, text and silkscreen', () => {
    const result = parseProject(v2Example);
    if (!result.ok) {
      throw new Error(JSON.stringify(result.error));
    }
    const kinds = new Set(result.value.features.map((f) => f.kind));
    expect([...kinds].sort()).toEqual([
      'component',
      'hole',
      'pad',
      'plane',
      'point',
      'silkLine',
      'silkText',
      'text',
      'trace',
      'via',
    ]);
    const nets = deriveNets(result.value);
    // The bottom trace joins header pin 2 to R1 pin 1; R1 pin 2 stays on its own.
    expect(nets.netOfAnchor('j1-2')).toBe(nets.netOfAnchor('r1-1'));
    expect(nets.netOfAnchor('r1-2')).not.toBe(nets.netOfAnchor('r1-1'));
    expect(nets.netOfFeature('g1')).toBe(nets.netOfAnchor('p2'));
  });

  it('loads a version 2 project with no net styles', () => {
    const result = parseProject(v2Example);
    expect(result.ok && result.value.netStyles).toEqual([]);
  });

  it('loads a version 3 project with named, coloured and locked nets', () => {
    const result = parseProject(v3Example);
    if (!result.ok) {
      throw new Error(JSON.stringify(result.error));
    }
    const nets = deriveNets(result.value);
    const look = (anchor: string) => {
      const net = nets.netOfAnchor(anchor);
      return net === undefined ? null : netAppearance(result.value, net);
    };
    expect(look('r1-1')).toMatchObject({ name: 'SIGNAL', color: 0x33aaff, locked: false });
    expect(look('p2')).toMatchObject({ name: 'GND', locked: true });
  });
});
