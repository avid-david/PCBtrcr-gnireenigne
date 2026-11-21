import { useEditor } from './store';

/** Bottom bar: zoom level and the latest notice (e.g. an import error). */
export function StatusBar() {
  const zoom = useEditor((s) => s.view.viewport.zoom);
  const activeName = useEditor(
    (s) => s.project.layers.find((l) => l.id === s.view.activeLayerId)?.name ?? '',
  );
  const notice = useEditor((s) => s.notice);
  return (
    <footer className="shell__status" aria-label="Status bar">
      <span>Layer: {activeName}</span>
      <span>Zoom: {zoom.toFixed(2)} px/mm</span>
      <span role="status" aria-label="Notice" className="shell__notice">
        {notice ?? ''}
      </span>
    </footer>
  );
}
