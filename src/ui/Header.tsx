import type { ChangeEvent } from 'react';
import type { Layer, LayerId } from '../core/model/project';
import { fitToView, setActiveLayer } from '../core/view/viewState';
import { useEditor, useEditorStore } from './store';

export interface HeaderProps {
  readonly appName: string;
  readonly onImportPhoto: (layerId: LayerId, file: File) => void;
}

const ACCEPTED_TYPES = 'image/png,image/jpeg,image/webp';

function ImportButton({
  layer,
  onImportPhoto,
}: { layer: Layer } & Pick<HeaderProps, 'onImportPhoto'>) {
  const onChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file !== undefined) {
      onImportPhoto(layer.id, file);
    }
  };
  return (
    <label className="button">
      Import {layer.name.toLowerCase()} photo…
      <input className="visually-hidden" type="file" accept={ACCEPTED_TYPES} onChange={onChange} />
    </label>
  );
}

function LayerSwitch() {
  const store = useEditorStore();
  const layers = useEditor((s) => s.project.layers);
  const activeId = useEditor((s) => s.view.activeLayerId);
  return (
    <div className="segmented" role="group" aria-label="Active layer (Tab)">
      {layers.map((layer) => (
        <button
          key={layer.id}
          type="button"
          aria-pressed={layer.id === activeId}
          title="Switch layer (Tab)"
          onClick={() => {
            store.getState().updateView((view, project) => setActiveLayer(view, project, layer.id));
          }}
        >
          {layer.name}
        </button>
      ))}
    </div>
  );
}

function NewProjectButton() {
  const store = useEditorStore();
  const onClick = () => {
    const hasPhotos = store.getState().project.layers.some((l) => l.image !== null);
    if (!hasPhotos || window.confirm('Discard the current project and start a new one?')) {
      store.getState().newProject();
    }
  };
  return (
    <button type="button" className="button" onClick={onClick}>
      New project
    </button>
  );
}

function AlignButton() {
  const store = useEditorStore();
  const aligning = useEditor((s) => s.align !== null);
  return (
    <button
      type="button"
      className="button"
      aria-pressed={aligning}
      title="Align photos (A)"
      onClick={() => {
        store.getState().setAligning(!aligning);
      }}
    >
      Align
    </button>
  );
}

/** Top bar: project and import actions, active layer switch, align mode and fit-to-view. */
export function Header({ appName, onImportPhoto }: HeaderProps) {
  const store = useEditorStore();
  const layers = useEditor((s) => s.project.layers);
  return (
    <header className="shell__header">
      <h1 className="shell__title">{appName}</h1>
      <NewProjectButton />
      {layers.map((layer) => (
        <ImportButton key={layer.id} layer={layer} onImportPhoto={onImportPhoto} />
      ))}
      <LayerSwitch />
      <AlignButton />
      <button
        type="button"
        className="button"
        title="Fit to view (Home)"
        onClick={() => {
          store.getState().updateView(fitToView);
        }}
      >
        Fit to view
      </button>
    </header>
  );
}
