import { describe, expect, it } from 'vitest';
import { imageToBoard } from '../core/alignment/alignment';
import {
  TOP_TRUTH,
  alignedTopProject,
  board,
  photo,
  pixelOf,
  run,
} from '../core/alignment/fixtures.test-support';
import { closeTo } from '../core/geometry/arbitraries.test-support';
import { getPoint } from '../core/model/points';
import { cornerPosition, createProject, type Project } from '../core/model/project';
import { deletePoint, setBoardSize, setLayerImage } from '../core/commands/command';
import {
  INITIAL_ALIGN,
  alignStep,
  nextCorner,
  previewProject,
  reconcileAlign,
  type AlignEvent,
  type AlignState,
} from './align';
import { alignHint } from './alignHint';

const withPhotos = (): Project =>
  run(createProject(), [
    setLayerImage('top', photo('t')),
    setLayerImage('bottom', photo('b')),
    setBoardSize(board),
  ]);

/** Feeds events through the tool, applying its commands like the store does. */
function drive(project: Project, events: AlignEvent[], start: AlignState = INITIAL_ALIGN) {
  let ids = 0;
  return events.reduce(
    (acc, event) => {
      const r = alignStep(acc.state, event, {
        project: acc.project,
        activeLayerId: acc.active,
        newId: () => `m${String(++ids)}`,
      });
      return {
        state: r.state,
        project: r.commands.reduce((p, c) => c.execute(p), acc.project),
        active: r.activateLayer ?? acc.active,
      };
    },
    { state: start, project, active: 'top' },
  );
}

const down = (board: { x: number; y: number }): AlignEvent => ({
  type: 'pointerdown',
  board,
  hitRadiusMm: 1,
});

describe('align tool', () => {
  it('places the 4 corners in order, then switches to matching', () => {
    const clicks = [
      { x: 1, y: 1 },
      { x: 90, y: 1 },
      { x: 90, y: 60 },
      { x: 1, y: 60 },
    ];
    const after = drive(
      withPhotos(),
      clicks.flatMap((b) => [down(b), { type: 'pointerup' } as const]),
    );
    expect(nextCorner(after.project, 'top')).toBeNull();
    expect(after.state.mode).toBe('matches');
    const tl = imageToBoard(
      after.project,
      'top',
      getPoint(after.project, { kind: 'corner', layerId: 'top', corner: 'tl' }) ?? { x: 0, y: 0 },
    );
    expect(tl !== null && closeTo(tl, cornerPosition(board, 'tl'), 1e-6)).toBe(true);
  });

  it('matches a feature across layers, hopping to the other photo and back', () => {
    const start = { ...INITIAL_ALIGN, mode: 'matches' as const };
    const first = drive(alignedTopProject(), [down({ x: 20, y: 20 })], start);
    expect(first.active).toBe('bottom');
    expect(first.state.pending?.layerId).toBe('top');
    const second = drive(
      alignedTopProject(),
      [down({ x: 20, y: 20 }), down({ x: 30, y: 25 })],
      start,
    );
    expect(second.active).toBe('top');
    expect(second.state.pending).toBeNull();
    expect(second.project.matches).toHaveLength(1);
    expect(Object.keys(second.project.matches[0]?.points ?? {})).toEqual(['top', 'bottom']);
  });

  it('re-clicking on the same layer moves the pending point; Esc cancels it', () => {
    const start = { ...INITIAL_ALIGN, mode: 'matches' as const };
    const project = run(alignedTopProject(), [setLayerImage('bottom', photo('b'))]);
    const twice = drive(project, [down({ x: 20, y: 20 })], start);
    const again = alignStep(twice.state, down({ x: 25, y: 20 }), {
      project,
      activeLayerId: 'top',
      newId: () => 'x',
    });
    expect(again.commands).toHaveLength(0);
    expect(again.state.pending?.px).not.toEqual(twice.state.pending?.px);
    expect(
      alignStep(
        again.state,
        { type: 'cancel' },
        { project, activeLayerId: 'top', newId: () => 'x' },
      ).state.pending,
    ).toBeNull();
  });

  it('drags an existing point with live preview and commits on release', () => {
    const project = alignedTopProject();
    const corner = cornerPosition(board, 'br');
    const ctx = { project, activeLayerId: 'top', newId: () => 'x' };
    const grabbed = alignStep(INITIAL_ALIGN, down(corner), ctx);
    expect(grabbed.state.drag?.ref).toEqual({ kind: 'corner', layerId: 'top', corner: 'br' });
    const moved = alignStep(grabbed.state, { type: 'pointermove', board: { x: 81, y: 51 } }, ctx);
    expect(
      getPoint(previewProject(project, moved.state), {
        kind: 'corner',
        layerId: 'top',
        corner: 'br',
      }),
    ).not.toEqual(pixelOf(TOP_TRUTH, corner));
    const dropped = alignStep(moved.state, { type: 'pointerup' }, ctx);
    expect(dropped.commands).toHaveLength(1);
    expect(dropped.state.drag).toBeNull();
  });

  it('a click on a point without moving changes nothing', () => {
    const ctx = { project: alignedTopProject(), activeLayerId: 'top', newId: () => 'x' };
    const grabbed = alignStep(INITIAL_ALIGN, down(cornerPosition(board, 'tl')), ctx);
    expect(alignStep(grabbed.state, { type: 'pointerup' }, ctx).commands).toHaveLength(0);
    expect(previewProject(ctx.project, INITIAL_ALIGN)).toBe(ctx.project);
  });

  it('ignores clicks without photo, extra corners and stray moves', () => {
    const empty = { project: createProject(), activeLayerId: 'top', newId: () => 'x' };
    expect(alignStep(INITIAL_ALIGN, down({ x: 5, y: 5 }), empty).commands).toHaveLength(0);
    const full = { project: alignedTopProject(), activeLayerId: 'top', newId: () => 'x' };
    expect(alignStep(INITIAL_ALIGN, down({ x: 40, y: 25 }), full).commands).toHaveLength(0);
    expect(
      alignStep(INITIAL_ALIGN, { type: 'pointermove', board: { x: 1, y: 1 } }, full).state,
    ).toBe(INITIAL_ALIGN);
    expect(alignStep(INITIAL_ALIGN, { type: 'pointerup' }, full).commands).toHaveLength(0);
  });

  it('switching mode drops a pending match', () => {
    const state = {
      ...INITIAL_ALIGN,
      mode: 'matches' as const,
      pending: { layerId: 'top', px: { x: 1, y: 1 } },
    };
    const ctx = { project: alignedTopProject(), activeLayerId: 'top', newId: () => 'x' };
    expect(alignStep(state, { type: 'setMode', mode: 'corners' }, ctx).state).toEqual(
      INITIAL_ALIGN,
    );
  });
});

describe('align hint', () => {
  const project = withPhotos();
  it('walks through the steps', () => {
    expect(alignHint(createProject(), INITIAL_ALIGN, 'top')).toBe('Enter the board size first.');
    expect(alignHint(run(createProject(), [setBoardSize(board)]), INITIAL_ALIGN, 'top')).toBe(
      'Import the top photo first.',
    );
    expect(alignHint(project, INITIAL_ALIGN, 'top')).toContain('top-left corner on the Top photo');
    expect(alignHint(alignedTopProject(), INITIAL_ALIGN, 'top')).toContain(
      'All 4 corners are placed',
    );
    const matching = { ...INITIAL_ALIGN, mode: 'matches' as const };
    expect(alignHint(project, matching, 'top')).toContain(
      'Click a via, hole or corner on the Top photo',
    );
    expect(
      alignHint(
        project,
        { ...matching, pending: { layerId: 'top', px: { x: 0, y: 0 } } },
        'bottom',
      ),
    ).toContain('same feature on the Bottom photo');
    const dragging = {
      ...INITIAL_ALIGN,
      drag: {
        ref: { kind: 'corner', layerId: 'top', corner: 'tl' } as const,
        px: { x: 0, y: 0 },
        start: { x: 0, y: 0 },
        toImage: () => null,
      },
    };
    expect(alignHint(project, dragging, 'top')).toBe('Release to place the point.');
  });
});

describe('previewProject', () => {
  it('returns the same object for the same drag step, so alignment solves are shared', () => {
    const project = alignedTopProject();
    const ctx = { project, activeLayerId: 'top', newId: () => 'x' };
    const grabbed = alignStep(INITIAL_ALIGN, down(cornerPosition(board, 'tr')), ctx);
    const moved = alignStep(grabbed.state, { type: 'pointermove', board: { x: 79, y: 1 } }, ctx);
    expect(previewProject(project, moved.state)).toBe(previewProject(project, moved.state));
    expect(previewProject(alignedTopProject(), moved.state)).not.toBe(
      previewProject(project, moved.state),
    );
  });
});

describe('reconcileAlign', () => {
  const pendingOnTop: AlignState = {
    ...INITIAL_ALIGN,
    mode: 'matches',
    pending: { layerId: 'top', px: { x: 1, y: 1 } },
  };

  it('keeps state that still fits and returns the same object', () => {
    const project = alignedTopProject();
    const other = setLayerImage('bottom', photo('b2')).execute(project);
    expect(reconcileAlign(pendingOnTop, project, other)).toBe(pendingOnTop);
    expect(reconcileAlign(INITIAL_ALIGN, project, other)).toBe(INITIAL_ALIGN);
  });

  it('drops a pending match click when its photo is replaced', () => {
    const project = alignedTopProject();
    const replaced = setLayerImage('top', photo('t2')).execute(project);
    expect(reconcileAlign(pendingOnTop, project, replaced)).toEqual({
      ...pendingOnTop,
      pending: null,
    });
  });

  it('drops a drag whose point was deleted or whose photo was replaced', () => {
    const project = alignedTopProject();
    const ctx = { project, activeLayerId: 'top', newId: () => 'x' };
    const grabbed = alignStep(INITIAL_ALIGN, down(cornerPosition(board, 'tl')), ctx).state;
    const ref = { kind: 'corner', layerId: 'top', corner: 'tl' } as const;
    expect(reconcileAlign(grabbed, project, deletePoint(ref).execute(project)).drag).toBeNull();
    expect(
      reconcileAlign(grabbed, project, setLayerImage('top', photo('t2')).execute(project)).drag,
    ).toBeNull();
    expect(
      reconcileAlign(
        grabbed,
        project,
        setBoardSize({ widthMm: 90, heightMm: 50 }).execute(project),
      ),
    ).toBe(grabbed);
  });
});
