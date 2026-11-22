import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { EditorStoreContext, createEditorStore } from './store';
import { Toolbar } from './Toolbar';

afterEach(cleanup);

describe('Toolbar groups', () => {
  it('shows the tools in labelled groups, in toolbar order', () => {
    render(
      <EditorStoreContext value={createEditorStore()}>
        <Toolbar />
      </EditorStoreContext>,
    );
    const groups = screen.getAllByRole('group');
    expect(groups.map((g) => g.getAttribute('aria-label'))).toEqual([
      'Select',
      'Connections',
      'Components',
      'Annotations',
      'Align',
    ]);
    const connections = screen.getByRole('group', { name: 'Connections' });
    expect(within(connections).getByText('Connections')).toBeDefined();
    expect(
      within(connections)
        .getAllByRole('button')
        .map((b) => b.getAttribute('aria-label')),
    ).toEqual(['Trace', 'Via', 'Pad', 'Connection point', 'Hole', 'Plane']);
    expect(within(screen.getByRole('group', { name: 'Select' })).queryByText('Select')).toBeNull();
  });
});
