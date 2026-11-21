import type { ChangeEvent } from 'react';
import type { Layer, LayerId } from '../core/model/project';
import { redoLabel, undoLabel } from '../core/commands/history';
import { fitToView, setActiveLayer } from '../core/view/viewState';
import { confirmDiscard, type ProjectFileActions } from './projectFileActions';
import { OpenProjectButton, SaveProject } from './ProjectFileControls';
import { useEditor, useEditorStore } from './store';

export interface HeaderProps {
  readonly appName: string;
  readonly onImportPhoto: (layerId: LayerId, file: File) => void;
  readonly files: ProjectFileActions;
  readonly onHelp: () => void;
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
    if (confirmDiscard(store, 'start a new project')) {
      store.getState().newProject();
    }
  };
  return (
    <button type="button" className="button" onClick={onClick}>
      New project
    </button>
  );
}

function UndoRedo() {
  const store = useEditorStore();
  const undoText = useEditor((s) => undoLabel(s.history));
  const redoText = useEditor((s) => redoLabel(s.history));
  return (
    <div className="segmented" role="group" aria-label="History">
      <button
        type="button"
        disabled={undoText === null}
        title={undoText === null ? 'Nothing to undo' : `Undo ${undoText} (Ctrl+Z)`}
        onClick={() => {
          store.getState().undo();
        }}
      >
        Undo
      </button>
      <button
        type="button"
        disabled={redoText === null}
        title={redoText === null ? 'Nothing to redo' : `Redo ${redoText} (Ctrl+Y)`}
        onClick={() => {
          store.getState().redo();
        }}
      >
        Redo
      </button>
    </div>
  );
}

/** Display unit for lengths (SPEC: mm or mil); the model stays in mm. */
function UnitSwitch() {
  const store = useEditorStore();
  const units = useEditor((s) => s.view.units);
  return (
    <div className="segmented" role="group" aria-label="Units">
      {(['mm', 'mil'] as const).map((unit) => (
        <button
          key={unit}
          type="button"
          aria-pressed={units === unit}
          onClick={() => {
            store.getState().updateView((view) => ({ ...view, units: unit }));
          }}
        >
          {unit}
        </button>
      ))}
    </div>
  );
}

/** Top bar: project file and import actions, undo/redo, active layer switch and fit-to-view. */
export function Header({ appName, onImportPhoto, files, onHelp }: HeaderProps) {
  const store = useEditorStore();
  const layers = useEditor((s) => s.project.layers);
  return (
    <header className="shell__header">
      <h1 className="shell__title">{appName}</h1>
      <NewProjectButton />
      <OpenProjectButton store={store} onOpen={files.openProject} />
      <SaveProject onSave={files.saveProject} />
      {layers.map((layer) => (
        <ImportButton key={layer.id} layer={layer} onImportPhoto={onImportPhoto} />
      ))}
      <UndoRedo />
      <UnitSwitch />
      <LayerSwitch />
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
      <button
        type="button"
        className="button"
        aria-label="Keyboard shortcuts"
        title="Keyboard shortcuts (?)"
        onClick={onHelp}
      >
        ?
      </button>
    </header>
  );
}
