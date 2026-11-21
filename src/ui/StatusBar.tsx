import { toolHint } from '../tools/registry';
import { toolContext } from './editorTransitions';
import { useEditor } from './store';

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
      <span role="status" aria-label="Notice" className="shell__notice">
        {notice ?? ''}
      </span>
    </footer>
  );
}
