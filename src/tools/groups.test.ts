import { describe, expect, it } from 'vitest';
import { TOOLS, TOOL_ORDER, toolbarGroups } from './registry';
import { TOOL_GROUPS } from './tool';

describe('toolbar groups', () => {
  it('shows Select, Connections, Components, Annotations and Align with their tools', () => {
    expect(toolbarGroups().map((g) => [g.label, g.tools])).toEqual([
      [null, ['select']],
      ['Connections', ['trace', 'via', 'pad', 'point', 'hole', 'plane']],
      ['Components', ['component']],
      ['Annotations', ['silk', 'text']],
      ['Align', ['align']],
    ]);
  });

  it('puts every tool in exactly one known group and leaves out groups without tools', () => {
    const known = TOOL_GROUPS.map((g) => g.id) as readonly string[];
    expect(TOOL_ORDER.every((id) => known.includes(TOOLS[id].group))).toBe(true);
    expect(toolbarGroups().flatMap((g) => g.tools)).toEqual(TOOL_ORDER);
    expect(toolbarGroups().some((g) => g.id === 'measure')).toBe(false);
  });
});
