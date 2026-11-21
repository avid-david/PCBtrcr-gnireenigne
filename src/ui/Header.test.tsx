import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { setLayerImage } from '../core/commands/command';
import { Header } from './Header';
import { EditorStoreContext, createEditorStore } from './store';

const image = { id: 'i', fileName: 'top.png', mimeType: 'image/png', widthPx: 1000, heightPx: 500 };

const fileActions = () => ({
  openProject: vi.fn(),
  saveProject: vi.fn(),
  restoreRecovery: vi.fn(),
  discardRecovery: vi.fn(),
  exportProject: vi.fn(),
});

function renderHeader() {
  const store = createEditorStore();
  const onImportPhoto = vi.fn();
  const files = fileActions();
  const onHelp = vi.fn();
  render(
    <EditorStoreContext value={store}>
      <Header appName="App" onImportPhoto={onImportPhoto} files={files} onHelp={onHelp} />
    </EditorStoreContext>,
  );
  return { store, onImportPhoto, files, onHelp };
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

  it('starts a new project at once when nothing is unsaved', () => {
    const { store } = renderHeader();
    const confirm = vi.spyOn(window, 'confirm');
    const before = store.getState().project;
    fireEvent.click(screen.getByRole('button', { name: 'New project' }));
    expect(confirm).not.toHaveBeenCalled();
    expect(store.getState().project).not.toBe(before);
  });

  it('asks before discarding unsaved changes', () => {
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

describe('Header project file', () => {
  const project = new File(['zip'], 'amp.pcbrt');

  it('opens the chosen project file', () => {
    const { files } = renderHeader();
    fireEvent.change(screen.getByLabelText('Open project file'), { target: { files: [project] } });
    expect(files.openProject).toHaveBeenCalledWith(project);
  });

  it('asks before opening over unsaved changes', () => {
    const { store, files } = renderHeader();
    act(() => {
      store.getState().dispatch(setLayerImage('top', image));
    });
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false);
    fireEvent.change(screen.getByLabelText('Open project file'), { target: { files: [project] } });
    expect(confirm.mock.calls[0]?.[0]).toContain('"board" has unsaved changes');
    expect(files.openProject).not.toHaveBeenCalled();
  });

  it('saves on click and shows the file name, marked while unsaved', () => {
    const { store, files } = renderHeader();
    const fileName = screen.getByLabelText('Project file');
    expect(fileName.textContent).toBe('board.pcbrt');
    act(() => {
      store.getState().dispatch(setLayerImage('top', image));
    });
    expect(fileName.textContent).toContain('unsaved changes');
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(files.saveProject).toHaveBeenCalledOnce();
  });
});

describe('Header undo and redo', () => {
  it('are disabled until there is something to undo, and name the step', () => {
    const { store } = renderHeader();
    const undo = screen.getByRole('button', { name: 'Undo' });
    const redo = screen.getByRole('button', { name: 'Redo' });
    expect((undo as HTMLButtonElement).disabled).toBe(true);
    act(() => {
      store.getState().dispatch(setLayerImage('top', image));
    });
    expect(undo.getAttribute('title')).toBe('Undo Import top.png (Ctrl+Z)');
    fireEvent.click(undo);
    expect(store.getState().project.layers[0]?.image).toBeNull();
    expect(redo.getAttribute('title')).toBe('Redo Import top.png (Ctrl+Y)');
    fireEvent.click(redo);
    expect(store.getState().project.layers[0]?.image).toBe(image);
  });
});
