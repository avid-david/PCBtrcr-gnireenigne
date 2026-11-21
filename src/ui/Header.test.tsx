import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { setLayerImage } from '../core/commands/command';
import { Header } from './Header';
import { EditorStoreContext, createEditorStore } from './store';

const image = { id: 'i', fileName: 'top.png', mimeType: 'image/png', widthPx: 1000, heightPx: 500 };

function renderHeader() {
  const store = createEditorStore();
  const onImportPhoto = vi.fn();
  render(
    <EditorStoreContext value={store}>
      <Header appName="App" onImportPhoto={onImportPhoto} />
    </EditorStoreContext>,
  );
  return { store, onImportPhoto };
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('Header', () => {
  it('passes the chosen file and its layer to the importer', () => {
    const { onImportPhoto } = renderHeader();
    const file = new File(['x'], 'bottom.jpg', { type: 'image/jpeg' });
    fireEvent.change(screen.getByLabelText('Import bottom photo…'), { target: { files: [file] } });
    expect(onImportPhoto).toHaveBeenCalledWith('bottom', file);
  });

  it('ignores an empty file selection', () => {
    const { onImportPhoto } = renderHeader();
    fireEvent.change(screen.getByLabelText('Import top photo…'), { target: { files: [] } });
    expect(onImportPhoto).not.toHaveBeenCalled();
  });

  it('switches the active layer with the layer buttons', () => {
    const { store } = renderHeader();
    const bottom = screen.getByRole('button', { name: 'Bottom' });
    fireEvent.click(bottom);
    expect(store.getState().view.activeLayerId).toBe('bottom');
    expect(bottom.getAttribute('aria-pressed')).toBe('true');
  });

  it('fits to view on click', () => {
    const { store } = renderHeader();
    act(() => {
      store.getState().dispatch(setLayerImage('top', image));
      store.getState().updateView((v) => ({ ...v, screen: { width: 800, height: 600 } }));
    });
    fireEvent.click(screen.getByRole('button', { name: 'Fit to view' }));
    expect(store.getState().view.viewport.zoom).toBeCloseTo(7.2);
  });

  it('starts a new project at once when there are no photos', () => {
    const { store } = renderHeader();
    const confirm = vi.spyOn(window, 'confirm');
    const before = store.getState().project;
    fireEvent.click(screen.getByRole('button', { name: 'New project' }));
    expect(confirm).not.toHaveBeenCalled();
    expect(store.getState().project).not.toBe(before);
  });

  it('asks before discarding photos', () => {
    const { store } = renderHeader();
    act(() => {
      store.getState().dispatch(setLayerImage('top', image));
    });
    vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true);
    fireEvent.click(screen.getByRole('button', { name: 'New project' }));
    expect(store.getState().project.layers[0]?.image).toBe(image);
    fireEvent.click(screen.getByRole('button', { name: 'New project' }));
    expect(store.getState().project.layers[0]?.image).toBeNull();
  });
});

describe('Header align button', () => {
  it('toggles align mode and shows its state', () => {
    const { store } = renderHeader();
    const button = screen.getByRole('button', { name: 'Align' });
    fireEvent.click(button);
    expect(store.getState().align).not.toBeNull();
    expect(button.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(button);
    expect(store.getState().align).toBeNull();
  });
});
