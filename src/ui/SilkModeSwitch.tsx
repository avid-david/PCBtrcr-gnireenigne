import type { SilkMode } from '../tools/settings';
import { useEditor, useEditorStore } from './store';

const MODES: readonly { readonly mode: SilkMode; readonly label: string }[] = [
  { mode: 'line', label: 'Line' },
  { mode: 'text', label: 'Text' },
];

/** Chooses whether the silkscreen tool draws lines or places text. */
export function SilkModeSwitch() {
  const store = useEditorStore();
  const current = useEditor((s) => s.settings.silk.mode);
  return (
    <div className="segmented" role="group" aria-label="Silkscreen mode">
      {MODES.map(({ mode, label }) => (
        <button
          key={mode}
          type="button"
          aria-pressed={mode === current}
          onClick={() => {
            store.getState().sendTool({ type: 'cancel' });
            store.getState().updateSettings((s) => ({ ...s, silk: { ...s.silk, mode } }));
          }}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
