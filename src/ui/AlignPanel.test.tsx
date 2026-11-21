import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { alignState } from './editorTransitions';
import { afterEach, describe, expect, it } from 'vitest';
import {
  FEATURES,
  alignedTopProject,
  matchAt,
  photo,
  run,
} from '../core/alignment/fixtures.test-support';
import { setLayerImage } from '../core/commands/command';
import { createProject, type Project } from '../core/model/project';
import { AlignPanel } from './AlignPanel';
import { EditorStoreContext, createEditorStore } from './store';
import { parseMillimetres } from './units';

function renderPanel(project: Project = createProject()) {
  const store = createEditorStore({ project, newId: () => 'id' });
  store.getState().setTool('align');
  render(
    <EditorStoreContext value={store}>
      <AlignPanel />
    </EditorStoreContext>,
  );
  return store;
}

afterEach(cleanup);

describe('AlignPanel', () => {
  it('sets the board size, accepting a decimal comma', () => {
    const store = renderPanel();
    expect(screen.getByRole('status', { name: 'Alignment hint' }).textContent).toBe(
      'Enter the board size first.',
    );
    const submit = screen.getByRole('button', { name: 'Set size' });
    expect((submit as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Width (mm)'), { target: { value: '80,5' } });
    fireEvent.change(screen.getByLabelText('Height (mm)'), { target: { value: '50' } });
    fireEvent.click(submit);
    expect(store.getState().project.board).toEqual({ widthMm: 80.5, heightMm: 50 });
  });

  it('switches between corners and matching points', () => {
    const store = renderPanel(alignedTopProject());
    fireEvent.click(screen.getByRole('button', { name: 'Matching points' }));
    expect(alignState(store.getState())?.mode).toBe('matches');
    expect(
      screen.getByRole('button', { name: 'Matching points' }).getAttribute('aria-pressed'),
    ).toBe('true');
  });

  it('shows status, residuals and outliers per layer, and deletes points', () => {
    const clicks = FEATURES.map((f, i) =>
      matchAt(`m${String(i)}`, f, i === 4 ? { x: 60, y: -40 } : { x: 0, y: 0 }),
    );
    const store = renderPanel(run(alignedTopProject(), clicks));
    const top = screen.getByRole('region', { name: 'Top alignment' });
    expect(within(top).getByText(/Aligned with 4 points · add more points/)).toBeDefined();
    const bottom = screen.getByRole('region', { name: 'Bottom alignment' });
    expect(within(bottom).getByText(/Aligned with 6 points · RMS \d\.\d{3} mm/)).toBeDefined();
    expect(within(bottom).getAllByText('outlier')).toHaveLength(1);
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Delete point 5 on Bottom' }));
    });
    expect(store.getState().project.matches.map((m) => m.id)).not.toContain('m4');
  });

  it('lists points of layers that are not aligned yet, without residuals', () => {
    const project = run(alignedTopProject(), [matchAt('m0', { x: 10, y: 10 })]);
    renderPanel(project);
    const bottom = screen.getByRole('region', { name: 'Bottom alignment' });
    expect(within(bottom).getByText('Needs at least 4 points (1 so far)')).toBeDefined();
    expect(within(bottom).getByText('—')).toBeDefined();
  });

  it('hides layers without photo', () => {
    renderPanel(run(createProject(), [setLayerImage('top', photo('t'))]));
    expect(screen.queryByRole('region', { name: 'Bottom alignment' })).toBeNull();
  });
});

describe('parseMillimetres', () => {
  it('accepts positive numbers with point or comma and rejects the rest', () => {
    expect(parseMillimetres(' 12.5 ')).toBe(12.5);
    expect(parseMillimetres('7,25')).toBe(7.25);
    expect(parseMillimetres('')).toBeNull();
    expect(parseMillimetres('0')).toBeNull();
    expect(parseMillimetres('-3')).toBeNull();
    expect(parseMillimetres('abc')).toBeNull();
  });
});
