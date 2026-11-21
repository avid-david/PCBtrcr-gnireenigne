import { useMemo, useState } from 'react';
import { solveAlignment, type LayerAlignment } from '../core/alignment/alignment';
import { deletePoint, setBoardSize } from '../core/commands/command';
import { pointsOnLayer, samePoint, type PointRef } from '../core/model/points';
import type { Layer, Project } from '../core/model/project';
import { previewProject } from '../tools/align';
import { alignHint, pointLabel } from '../tools/alignHint';
import { alignState } from './editorTransitions';
import { useEditor, useEditorStore } from './store';
import { formatLength, parseLength, unitLabel } from './units';

const STATUS_TEXT: Readonly<Record<LayerAlignment['status'], string>> = {
  aligned: 'Aligned',
  'no-photo': 'No photo',
  'too-few-points': 'Needs at least 4 points',
  degenerate: 'Points are in a line or on top of each other',
};

function SizeField(props: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label>
      {props.label}{' '}
      <input
        inputMode="decimal"
        value={props.value}
        onChange={(e) => {
          props.onChange(e.target.value);
        }}
      />
    </label>
  );
}

/** Switching units starts the form over, so its text is shown in the new unit. */
function BoardSize() {
  const unit = useEditor((s) => s.view.units);
  return <BoardSizeForm key={unit} />;
}

function BoardSizeForm() {
  const store = useEditorStore();
  const board = useEditor((s) => s.project.board);
  const unit = useEditor((s) => s.view.units);
  const shown = (mm: number | undefined) => (mm === undefined ? '' : formatLength(mm, unit));
  const [width, setWidth] = useState(shown(board?.widthMm));
  const [height, setHeight] = useState(shown(board?.heightMm));
  const widthMm = parseLength(width, unit);
  const heightMm = parseLength(height, unit);
  return (
    <form
      className="board-size"
      aria-label="Board size"
      onSubmit={(event) => {
        event.preventDefault();
        if (widthMm !== null && heightMm !== null) {
          store.getState().dispatch(setBoardSize({ widthMm, heightMm }));
        }
      }}
    >
      <SizeField label={unitLabel('Width (mm)', unit)} value={width} onChange={setWidth} />
      <SizeField label={unitLabel('Height (mm)', unit)} value={height} onChange={setHeight} />
      <button type="submit" className="button" disabled={widthMm === null || heightMm === null}>
        Set size
      </button>
    </form>
  );
}

function ModeSwitch() {
  const store = useEditorStore();
  const mode = useEditor((s) => alignState(s)?.mode);
  const choose = (next: 'corners' | 'matches') => () => {
    store.getState().setAlignMode(next);
  };
  return (
    <div className="segmented" role="group" aria-label="Points to place">
      <button type="button" aria-pressed={mode === 'corners'} onClick={choose('corners')}>
        Corners
      </button>
      <button type="button" aria-pressed={mode === 'matches'} onClick={choose('matches')}>
        Matching points
      </button>
    </div>
  );
}

function statusLine(a: LayerAlignment): string {
  if (a.status !== 'aligned') {
    return `${STATUS_TEXT[a.status]} (${String(a.pointCount)} so far)`;
  }
  const rms =
    a.pointCount > 4
      ? ` · RMS ${(a.rmsMm ?? 0).toFixed(3)} mm`
      : ' · add more points to measure accuracy';
  return `${STATUS_TEXT.aligned} with ${String(a.pointCount)} points${rms}`;
}

/** The project as drawn: with a dragged point dropped where it is now (live preview). */
function usePreviewProject(): Project {
  const saved = useEditor((s) => s.project);
  const align = useEditor(alignState);
  return useMemo(() => (align === null ? saved : previewProject(saved, align)), [saved, align]);
}

function PointRow({
  project,
  point,
  alignment,
}: {
  project: Project;
  point: PointRef;
  alignment: LayerAlignment;
}) {
  const store = useEditorStore();
  const fit = alignment.fits.find((f) => samePoint(f.ref, point));
  const label = pointLabel(project, point);
  const layerName = project.layers.find((l) => l.id === point.layerId)?.name ?? point.layerId;
  return (
    <li className={fit?.outlier === true ? 'is-outlier' : undefined}>
      <span className="align-points__label">{label}</span>
      <span>{fit === undefined ? '—' : `${fit.residualMm.toFixed(3)} mm`}</span>
      {fit?.outlier === true ? <strong className="align-points__badge">outlier</strong> : <span />}
      <button
        type="button"
        className="icon-button"
        aria-label={`Delete point ${label} on ${layerName}`}
        onClick={() => {
          store.getState().dispatch(deletePoint(point));
        }}
      >
        ×
      </button>
    </li>
  );
}

function LayerPoints({ layer }: { layer: Layer }) {
  const project = usePreviewProject();
  const alignment = solveAlignment(project).get(layer.id);
  if (alignment === undefined || layer.image === null) {
    return null;
  }
  return (
    <section className="align-layer" aria-label={`${layer.name} alignment`}>
      <h3>{layer.name}</h3>
      <p className="align-layer__status">{statusLine(alignment)}</p>
      <ul className="align-points">
        {pointsOnLayer(project, layer.id).map(({ ref }) => (
          <PointRow
            key={pointLabel(project, ref)}
            project={project}
            point={ref}
            alignment={alignment}
          />
        ))}
      </ul>
    </section>
  );
}

/** Side panel content while align mode is on. */
export function AlignPanel() {
  const hint = useEditor((s) =>
    s.tool.id === 'align' ? alignHint(s.project, s.tool.state, s.view.activeLayerId) : '',
  );
  const layers = useEditor((s) => s.project.layers);
  return (
    <div className="align-panel">
      <h2 className="panel__title">Alignment</h2>
      <BoardSize />
      <ModeSwitch />
      <p className="align-panel__hint" role="status" aria-label="Alignment hint">
        {hint}
      </p>
      {layers.map((layer) => (
        <LayerPoints key={layer.id} layer={layer} />
      ))}
    </div>
  );
}
