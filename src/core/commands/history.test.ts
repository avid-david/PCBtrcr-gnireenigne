import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { smdPad, via, withFeatures } from '../model/features.test-support';
import type { Command } from './command';
import { addFeature, moveFeatures, removeFeatures } from './features';
import {
  EMPTY_HISTORY,
  execute,
  projectsInHistory,
  redo,
  redoLabel,
  undo,
  undoLabel,
} from './history';

/** Random edit scripts over a few features. */
const commandArb: fc.Arbitrary<Command> = fc.oneof(
  fc.nat(20).map((i) => addFeature(via(`v${String(i)}`, { x: i, y: i }))),
  fc.nat(20).map((i) => removeFeatures([`v${String(i)}`])),
  fc
    .tuple(fc.nat(20), fc.integer({ min: -5, max: 5 }))
    .map(([i, d]) => moveFeatures([`v${String(i)}`], { x: d, y: -d })),
);

describe('history', () => {
  it('undo after execute restores the exact previous state; redo restores the next', () => {
    fc.assert(
      fc.property(fc.array(commandArb, { maxLength: 15 }), commandArb, (script, last) => {
        const start = script.reduce((s, c) => execute(s.project, s.history, c), {
          project: withFeatures([smdPad('p', { x: 0, y: 0 })]),
          history: EMPTY_HISTORY,
        });
        const done = execute(start.project, start.history, last);
        if (done.project === start.project) {
          return done.history === start.history;
        }
        const undone = undo(done.project, done.history);
        const redone = undone && redo(undone.project, undone.history);
        return undone?.project === start.project && redone?.project === done.project;
      }),
    );
  });

  it('a new edit after undo discards the redo branch', () => {
    const a = execute(withFeatures([]), EMPTY_HISTORY, addFeature(via('a', { x: 0, y: 0 })));
    const undone = undo(a.project, a.history);
    expect(undone && redoLabel(undone.history)).toBe('Add via');
    const b =
      undone && execute(undone.project, undone.history, addFeature(via('b', { x: 1, y: 1 })));
    expect(b?.history.future).toEqual([]);
    expect(b && undoLabel(b.history)).toBe('Add via');
  });

  it('has nothing to undo or redo at the start, and no-op commands are not recorded', () => {
    expect(undo(withFeatures([]), EMPTY_HISTORY)).toBeNull();
    expect(redo(withFeatures([]), EMPTY_HISTORY)).toBeNull();
    expect(undoLabel(EMPTY_HISTORY)).toBeNull();
    const noop = execute(withFeatures([]), EMPTY_HISTORY, removeFeatures([]));
    expect(noop.history).toBe(EMPTY_HISTORY);
  });

  it('lists the projects it can return to', () => {
    const start = withFeatures([]);
    const a = execute(start, EMPTY_HISTORY, addFeature(via('a', { x: 0, y: 0 })));
    const undone = undo(a.project, a.history);
    expect(undone && projectsInHistory(undone.history)).toEqual([a.project]);
  });
});
