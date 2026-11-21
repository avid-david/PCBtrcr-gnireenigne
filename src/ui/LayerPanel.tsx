import { useId, type ReactNode } from 'react';
import { solveAlignment } from '../core/alignment/alignment';
import { setLayerMirrored } from '../core/commands/command';
import type { Layer } from '../core/model/project';
import {
  isContentVisible,
  isPhotoVisible,
  setContentVisible,
  setOverlayOpacity,
  setPhotoVisible,
  type LayerContent,
} from '../core/view/viewState';
import { useEditor, useEditorStore } from './store';

/** Mirroring only applies before alignment: an aligned photo's transform already includes it. */
function MirrorCheckbox({ layer }: { layer: Layer }) {
  const store = useEditorStore();
  const aligned = useEditor((s) => solveAlignment(s.project).get(layer.id)?.status === 'aligned');
  return (
    <label title={aligned ? 'The alignment already accounts for mirroring.' : undefined}>
      <input
        type="checkbox"
        checked={layer.mirrored}
        disabled={aligned}
        onChange={(e) => {
          store.getState().dispatch(setLayerMirrored(layer.id, e.target.checked));
        }}
      />{' '}
      Mirror horizontally
    </label>
  );
}

const CONTENTS: readonly { readonly content: LayerContent; readonly label: string }[] = [
  { content: 'copper', label: 'Copper' },
  { content: 'silk', label: 'Silkscreen' },
  { content: 'text', label: 'Notes' },
];

/** Show/hide toggles for what is drawn on a layer (SPEC "Layers and overlay"). */
function ContentToggle({
  layer,
  content,
  label,
}: {
  layer: Layer;
  content: LayerContent;
  label: string;
}) {
  const store = useEditorStore();
  const visible = useEditor((s) => isContentVisible(s.view, layer.id, content));
  return (
    <label>
      <input
        type="checkbox"
        checked={visible}
        onChange={(e) => {
          const show = e.target.checked;
          store
            .getState()
            .updateView((view) => setContentVisible(view, { layerId: layer.id, content }, show));
        }}
      />{' '}
      Show {label.toLowerCase()}
    </label>
  );
}

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
      {CONTENTS.map((c) => (
        <ContentToggle key={c.content} layer={layer} content={c.content} label={c.label} />
      ))}
      <MirrorCheckbox layer={layer} />
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

/** Layer settings and the overlay opacity; `children` (the inspector) go on top. */
export function LayerPanel({ children }: { readonly children?: ReactNode }) {
  const layers = useEditor((s) => s.project.layers);
  return (
    <>
      {children}
      <h2 className="panel__title">Layers</h2>
      <OverlayOpacity />
      {layers.map((layer) => (
        <LayerRow key={layer.id} layer={layer} />
      ))}
    </>
  );
}
