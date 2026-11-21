import { describe, expect, it } from 'vitest';
import { setNetStyle } from '../connectivity/netStyles';
import {
  bound,
  free,
  hole,
  smdPad,
  trace,
  twoPadComponent,
  via,
  withFeatures,
} from '../model/features.test-support';
import { EXPORTERS } from './exporters';
import { netlist } from './netlist';

const r1 = { ...twoPadComponent('r', { x: 0, y: 0 }), designator: 'R1' };
const unnamed = { ...twoPadComponent('u', { x: 20, y: 0 }), designator: '' };
const board = setNetStyle(
  withFeatures([
    r1,
    unnamed,
    via('v', { x: 5, y: 0 }),
    smdPad('p', { x: 9, y: 9 }),
    hole('h', { x: 30, y: 30 }, false),
    trace('t', [bound('t1', 'r.2'), bound('t2', 'v'), bound('t3', 'u.1')]),
    trace('lonely', [free('l1', { x: 50, y: 50 }), free('l2', { x: 51, y: 50 })]),
  ]),
  'v',
  { name: 'OUT, "main"', color: 0x00ff00 },
);

const exporter = (id: string) => {
  const found = EXPORTERS.find((e) => e.id === id);
  if (found === undefined) {
    throw new Error(id);
  }
  return found;
};

describe('netlist', () => {
  it('lists nets with pins and anchors, sorted by name, leaving out trace-only nets', () => {
    expect(netlist(board).map((e) => [e.name, e.members])).toEqual([
      ['Net 1', ['R1.1']],
      ['Net 3', ['?.2']],
      ['Net 4', ['pad:p']],
      ['OUT, "main"', ['R1.2', '?.1', 'via:v']],
    ]);
  });

  it('sorts numbered names naturally', () => {
    const many = withFeatures(
      Array.from({ length: 11 }, (_, i) => via(`v${String(i)}`, { x: i, y: 0 })),
    );
    expect(
      netlist(many)
        .map((e) => e.name)
        .slice(0, 3),
    ).toEqual(['Net 1', 'Net 2', 'Net 3']);
  });
});

describe('netlist exporters', () => {
  it('writes JSON with names, colours and members', () => {
    const json = JSON.parse(exporter('netlist-json').export(board)) as {
      nets: { name: string; color: string }[];
    };
    expect(json.nets.at(-1)).toEqual({
      name: 'OUT, "main"',
      color: '#00ff00',
      members: ['R1.2', '?.1', 'via:v'],
    });
  });

  it('writes CSV with one row per member, quoting where needed', () => {
    const csv = exporter('netlist-csv').export(board);
    expect(csv.split('\r\n')).toEqual([
      'net,member',
      'Net 1,R1.1',
      'Net 3,?.2',
      'Net 4,pad:p',
      '"OUT, ""main""",R1.2',
      '"OUT, ""main""",?.1',
      '"OUT, ""main""",via:v',
      '',
    ]);
  });
});
