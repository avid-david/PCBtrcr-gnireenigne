import { TOOLS, TOOL_ORDER, type ToolId } from '../tools/registry';
import { useEditor, useEditorStore } from './store';

/** Small glyphs for the narrow toolbar; the full name is in the tooltip and accessible name. */
const ICONS: Readonly<Record<ToolId, string>> = {
  select: '↖',
  trace: '╱',
  via: '◎',
  pad: '▭',
  point: '⊙',
  hole: '○',
  align: '⌖',
};

/** Tool buttons (SPEC F3: a shortcut for every tool, shown in its tooltip) and grid snapping. */
export function Toolbar() {
  const store = useEditorStore();
  const active = useEditor((s) => s.tool.id);
  const grid = useEditor((s) => s.settings.grid.enabled);
  return (
    <nav className="shell__toolbar" aria-label="Tools">
      {TOOL_ORDER.map((id) => (
        <button
          key={id}
          type="button"
          className="tool-button"
          aria-label={TOOLS[id].label}
          aria-pressed={active === id}
          title={`${TOOLS[id].label} (${TOOLS[id].shortcut.toUpperCase()})`}
          onClick={() => {
            store.getState().setTool(id);
          }}
        >
          {ICONS[id]}
        </button>
      ))}
      <hr className="toolbar__separator" />
      <button
        type="button"
        className="tool-button"
        aria-label="Snap to grid"
        aria-pressed={grid}
        title="Snap to grid (G)"
        onClick={() => {
          store
            .getState()
            .updateSettings((s) => ({ ...s, grid: { ...s.grid, enabled: !s.grid.enabled } }));
        }}
      >
        #
      </button>
    </nav>
  );
}
