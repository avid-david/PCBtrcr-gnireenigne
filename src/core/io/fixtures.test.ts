import { describe, expect, it } from 'vitest';
import { deriveNets } from '../connectivity/nets';
import v1Example from './fixtures/v1-example.json?raw';
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
});
