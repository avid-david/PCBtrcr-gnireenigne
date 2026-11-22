import type { MouseEvent } from 'react';
import { Fragment } from 'react';
import { TOOLS, toolbarGroups, type ToolId } from '../tools/registry';
import { useEditor, useEditorStore } from './store';

/** Small glyphs for the narrow toolbar; the full name is in the tooltip and accessible name. */
const ICONS: Readonly<Record<ToolId, string>> = {
  select: '↖',
  trace: '╱',
  via: '◎',
  pad: '▭',
  point: '⊙',
  hole: '○',
  component: '▣',
  plane: '▨',
  silk: '✎',
  text: 'T',
  align: '⌖',
};

const keepFocus = (e: MouseEvent) => {
  e.preventDefault();
};

const GROUPS = toolbarGroups();

function ToolButton({ id }: { id: ToolId }) {
  const store = useEditorStore();
  const active = useEditor((s) => s.tool.id);
  return (
    <button
      type="button"
      className="tool-button"
      aria-label={TOOLS[id].label}
      aria-pressed={active === id}
      title={`${TOOLS[id].label} (${TOOLS[id].shortcut.toUpperCase()})`}
      // Keep focus on the board: a focused button would take Enter, which finishes a trace.
      onMouseDown={keepFocus}
      onClick={() => {
        store.getState().setTool(id);
      }}
    >
      {ICONS[id]}
    </button>
  );
}

/**
 * Tool buttons in labelled groups separated by a rule (SPEC F7; a shortcut for every tool, shown
 * in its tooltip) and grid snapping.
 */
export function Toolbar() {
  const store = useEditorStore();
  const grid = useEditor((s) => s.settings.grid.enabled);
  return (
    <nav className="shell__toolbar" aria-label="Tools">
      {GROUPS.map((group, index) => (
        <Fragment key={group.id}>
          {index > 0 ? <hr className="toolbar__separator" /> : null}
          <div className="toolbar__group" role="group" aria-label={group.label ?? 'Select'}>
            {group.label === null ? null : (
              <span className="toolbar__caption" aria-hidden="true">
                {group.label}
              </span>
            )}
            {group.tools.map((id) => (
              <ToolButton key={id} id={id} />
            ))}
          </div>
        </Fragment>
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
