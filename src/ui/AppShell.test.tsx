import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setLayerImage } from '../core/commands/command';
import { AppShell } from './AppShell';
import { EditorStoreContext, createEditorStore, type EditorStore } from './store';

class FakeResizeObserver {
  observe = vi.fn();
  disconnect = vi.fn();
}

const image = { id: 'i', fileName: 'top.png', mimeType: 'image/png', widthPx: 1000, heightPx: 500 };

function renderShell(store: EditorStore = createEditorStore()) {
  const onImportPhoto = vi.fn();
  const unmountBoard = vi.fn();
  const mountBoard = vi.fn(() => unmountBoard);
  const files = {
    openProject: vi.fn(),
    saveProject: vi.fn(),
    restoreRecovery: vi.fn(),
    discardRecovery: vi.fn(),
  };
  const view = render(
    <EditorStoreContext value={store}>
      <AppShell
        appName="PCB Reverse Tracer"
        onImportPhoto={onImportPhoto}
        mountBoard={mountBoard}
        files={files}
      />
    </EditorStoreContext>,
  );
  return { store, onImportPhoto, mountBoard, unmountBoard, view, files };
}

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', FakeResizeObserver);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('AppShell', () => {
  it('shows the app name and the labelled regions', () => {
    renderShell();
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('PCB Reverse Tracer');
    expect(screen.getByRole('navigation', { name: 'Tools' })).toBeDefined();
    expect(screen.getByRole('main', { name: 'Board view' })).toBeDefined();
    expect(screen.getByRole('complementary', { name: 'Layers' })).toBeDefined();
    expect(screen.getByRole('contentinfo', { name: 'Status bar' })).toBeDefined();
  });

  it('mounts the board into the host element and unmounts it again', () => {
    const { mountBoard, unmountBoard, view } = renderShell();
    expect(mountBoard).toHaveBeenCalledWith(screen.getByTestId('board-host'));
    view.unmount();
    expect(unmountBoard).toHaveBeenCalled();
  });

  it('shows a hint until a photo is imported', () => {
    const { store } = renderShell();
    expect(screen.queryByText('Import a photo to start.')).not.toBeNull();
    act(() => {
      store.getState().dispatch(setLayerImage('top', image));
    });
    expect(screen.queryByText('Import a photo to start.')).toBeNull();
  });

  it('Tab switches the active layer from anywhere, also from a focused control', () => {
    const { store } = renderShell();
    const button = screen.getByRole('button', { name: 'New project' });
    button.focus();
    const event = fireEvent.keyDown(button, { key: 'Tab' });
    expect(event).toBe(false);
    expect(store.getState().view.activeLayerId).toBe('bottom');
    expect(screen.getByText('Layer: Bottom')).toBeDefined();
  });

  it('ignores Tab with modifier keys', () => {
    const { store } = renderShell();
    fireEvent.keyDown(window, { key: 'Tab', ctrlKey: true });
    expect(store.getState().view.activeLayerId).toBe('top');
  });

  it('Home fits the photos into the view', () => {
    const store = createEditorStore();
    store.getState().dispatch(setLayerImage('top', image));
    renderShell(store);
    act(() => {
      store.getState().updateView((v) => ({ ...v, screen: { width: 800, height: 600 } }));
    });
    fireEvent.keyDown(window, { key: 'Home' });
    expect(store.getState().view.viewport.zoom).toBeCloseTo(7.2);
    expect(screen.getByText('Zoom: 7.20 px/mm')).toBeDefined();
  });

  it('shows notices in the status bar', () => {
    const { store } = renderShell();
    act(() => {
      store.getState().setNotice('Unsupported file type');
    });
    expect(screen.getByText('Unsupported file type').getAttribute('role')).toBe('status');
  });
});

describe('AppShell tools', () => {
  it('shows the active tool’s hint and the inspector, or the align panel in align mode', () => {
    const { store } = renderShell();
    expect(screen.getByLabelText('Tool hint').textContent).toContain('Click to select');
    expect(screen.getByRole('region', { name: 'Snapping' })).toBeDefined();
    act(() => {
      store.getState().setTool('align');
    });
    expect(screen.getByText('Alignment')).toBeDefined();
    expect(screen.queryByRole('region', { name: 'Snapping' })).toBeNull();
  });
});

describe('AppShell project files', () => {
  it('Ctrl+S saves and Ctrl+O opens the file picker, even while typing', () => {
    const { files, view } = renderShell();
    const input = view.container.querySelector<HTMLInputElement>('input[accept=".pcbrt"]');
    const click = vi.spyOn(input ?? document.body, 'click').mockImplementation(() => undefined);
    fireEvent.keyDown(window, { key: 's', ctrlKey: true });
    fireEvent.keyDown(window, { key: 'o', ctrlKey: true });
    expect(files.saveProject).toHaveBeenCalledOnce();
    expect(click).toHaveBeenCalledOnce();
  });

  it('offers recovery of autosaved work and hides the banner once answered', () => {
    const { store, files } = renderShell();
    expect(screen.queryByRole('region', { name: 'Recover unsaved work' })).toBeNull();
    act(() => {
      store.getState().setRecovery({ fileName: 'amp', savedAt: 0 });
    });
    const banner = screen.getByRole('region', { name: 'Recover unsaved work' });
    expect(banner.textContent).toContain('“amp”');
    fireEvent.click(screen.getByRole('button', { name: 'Restore' }));
    fireEvent.click(screen.getByRole('button', { name: 'Discard' }));
    expect(files.restoreRecovery).toHaveBeenCalledOnce();
    expect(files.discardRecovery).toHaveBeenCalledOnce();
    act(() => {
      store.getState().setRecovery(null);
    });
    expect(screen.queryByRole('region', { name: 'Recover unsaved work' })).toBeNull();
  });
});
