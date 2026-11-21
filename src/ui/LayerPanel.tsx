import { useId } from 'react';
import { setLayerMirrored } from '../core/commands/command';
import type { Layer } from '../core/model/project';
import { isPhotoVisible, setOverlayOpacity, setPhotoVisible } from '../core/view/viewState';
import { useEditor, useEditorStore } from './store';

function LayerRow({ layer }: { layer: Layer }) {
  const store = useEditorStore();
  const visible = useEditor((s) => isPhotoVisible(s.view, layer.id));
  const active = useEditor((s) => s.view.activeLayerId === layer.id);
  return (
    <fieldset className="layer" aria-current={active}>
      <legend>
        {layer.name}
        {active ? ' (active)' : ''}
      </legend>
      <p className="layer__file">{layer.image?.fileName ?? 'No photo'}</p>
      <label>
        <input
          type="checkbox"
          checked={visible}
          onChange={(e) => {
            const show = e.target.checked;
            store.getState().updateView((view) => setPhotoVisible(view, layer.id, show));
          }}
        />{' '}
        Show photo
      </label>
      <label>
        <input
          type="checkbox"
          checked={layer.mirrored}
          onChange={(e) => {
            store.getState().dispatch(setLayerMirrored(layer.id, e.target.checked));
          }}
        />{' '}
        Mirror horizontally
      </label>
    </fieldset>
  );
}

function OverlayOpacity() {
  const store = useEditorStore();
  const percent = useEditor((s) => Math.round(s.view.overlayOpacity * 100));
  const id = useId();
  return (
    <div className="overlay">
      <label htmlFor={id}>Overlay opacity</label>
      <output htmlFor={id}>{percent} %</output>
      <input
        id={id}
        type="range"
        min={0}
        max={100}
        step={1}
        value={percent}
        onChange={(e) => {
          const opacity = Number(e.target.value) / 100;
          store.getState().updateView((view) => setOverlayOpacity(view, opacity));
        }}
      />
    </div>
  );
}

/** Side panel: per-layer photo settings and the overlay opacity of the inactive layer. */
export function LayerPanel() {
  const layers = useEditor((s) => s.project.layers);
  return (
    <aside className="shell__panel" aria-label="Layers">
      <h2 className="panel__title">Layers</h2>
      <OverlayOpacity />
      {layers.map((layer) => (
        <LayerRow key={layer.id} layer={layer} />
      ))}
    </aside>
  );
}
