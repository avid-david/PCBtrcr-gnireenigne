import { toolHint } from '../tools/registry';
import { toolContext } from './editorTransitions';
import { useEditor, useEditorStore } from './store';
import { formatLength } from './units';

/** The landmark offer of a via placed over another one (SPEC F9), with its two answers. */
function LandmarkOfferBar() {
  const store = useEditorStore();
  const offer = useEditor((s) => s.landmarkOffer);
  const units = useEditor((s) => s.view.units);
  if (offer === null) {
    return null;
  }
  const at = `(${formatLength(offer.at.x, units)}, ${formatLength(offer.at.y, units)}) ${units}`;
  return (
    <span className="shell__offer" role="group" aria-label="Landmark offer">
      <span>Overlaps via at {at} — same via?</span>
      <button
        type="button"
        className="button"
        onClick={() => {
          store.getState().acceptLandmark();
        }}
      >
        Use as landmark
      </button>
      <button
        type="button"
        className="button"
        onClick={() => {
          store.getState().dismissLandmark();
        }}
      >
        Keep both
      </button>
    </span>
  );
}

/** Bottom bar: layer, zoom, what the active tool expects next, and the latest notice. */
export function StatusBar() {
  const zoom = useEditor((s) => s.view.viewport.zoom);
  const activeName = useEditor(
    (s) => s.project.layers.find((l) => l.id === s.view.activeLayerId)?.name ?? '',
  );
  const notice = useEditor((s) => s.notice);
  const hint = useEditor((s) =>
    toolHint(
      s.tool,
      toolContext(s, () => ''),
    ),
  );
  return (
    <footer className="shell__status" aria-label="Status bar">
      <span>Layer: {activeName}</span>
      <span>Zoom: {zoom.toFixed(2)} px/mm</span>
      <span className="shell__hint" aria-label="Tool hint">
        {hint}
      </span>
      <LandmarkOfferBar />
      <span role="status" aria-label="Notice" className="shell__notice">
        {notice ?? ''}
      </span>
    </footer>
  );
}
