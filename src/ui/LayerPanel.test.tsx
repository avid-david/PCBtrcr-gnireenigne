import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { setLayerImage } from '../core/commands/command';
import { isPhotoVisible } from '../core/view/viewState';
import { LayerPanel } from './LayerPanel';
import { alignedTopProject } from '../core/alignment/fixtures.test-support';
import { EditorStoreContext, createEditorStore } from './store';

function renderPanel() {
  const store = createEditorStore();
  render(
    <EditorStoreContext value={store}>
      <LayerPanel />
    </EditorStoreContext>,
  );
  return store;
}

const layerGroup = (name: string) => screen.getByRole('group', { name: new RegExp(`^${name}`) });

afterEach(cleanup);

describe('LayerPanel', () => {
  it('lists layers with their photo and marks the active one', () => {
    const store = renderPanel();
    expect(within(layerGroup('Top')).getByText('No photo')).toBeDefined();
    expect(layerGroup('Top').getAttribute('aria-current')).toBe('true');
    act(() => {
      store.getState().dispatch(
        setLayerImage('top', {
          id: 'i',
          fileName: 'top.png',
          mimeType: 'image/png',
          widthPx: 1,
          heightPx: 1,
        }),
      );
    });
    expect(within(layerGroup('Top')).getByText('top.png')).toBeDefined();
  });

  it('sets the overlay opacity from the slider', () => {
    const store = renderPanel();
    fireEvent.change(screen.getByLabelText('Overlay opacity'), { target: { value: '30' } });
    expect(store.getState().view.overlayOpacity).toBeCloseTo(0.3);
    expect(screen.getByText('30 %')).toBeDefined();
  });

  it('hides and shows a photo', () => {
    const store = renderPanel();
    const checkbox = within(layerGroup('Bottom')).getByLabelText('Show photo');
    fireEvent.click(checkbox);
    expect(isPhotoVisible(store.getState().view, 'bottom')).toBe(false);
    fireEvent.click(checkbox);
    expect(isPhotoVisible(store.getState().view, 'bottom')).toBe(true);
  });

  it('toggles the mirror through a command', () => {
    const store = renderPanel();
    const mirror = within(layerGroup('Bottom')).getByLabelText('Mirror horizontally');
    expect((mirror as HTMLInputElement).checked).toBe(true);
    fireEvent.click(mirror);
    expect(store.getState().project.layers[1]?.mirrored).toBe(false);
  });
});

describe('LayerPanel mirror checkbox', () => {
  it('is disabled once the layer is aligned, because the alignment includes mirroring', () => {
    const store = createEditorStore({ project: alignedTopProject() });
    render(
      <EditorStoreContext value={store}>
        <LayerPanel>
          <p>extra content</p>
        </LayerPanel>
      </EditorStoreContext>,
    );
    const top = screen.getByRole('group', { name: /^Top/ });
    expect(within(top).getByLabelText<HTMLInputElement>('Mirror horizontally').disabled).toBe(true);
    const bottom = screen.getByRole('group', { name: /^Bottom/ });
    expect(within(bottom).getByLabelText<HTMLInputElement>('Mirror horizontally').disabled).toBe(
      false,
    );
    expect(screen.getByText('extra content')).toBeDefined();
  });
});
