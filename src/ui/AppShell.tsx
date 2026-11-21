import './theme.css';
import type { LayerId } from '../core/model/project';
import { AlignPanel } from './AlignPanel';
import { BoardView } from './BoardView';
import { Header } from './Header';
import { LayerPanel } from './LayerPanel';
import { useShortcuts } from './shortcuts';
import { StatusBar } from './StatusBar';
import { useEditor, useEditorStore } from './store';

export interface AppShellProps {
  readonly appName: string;
  readonly onImportPhoto: (layerId: LayerId, file: File) => void;
  readonly mountBoard: (host: HTMLElement) => () => void;
}

/** Application frame. Expects an `EditorStoreContext` provider above it. */
export function AppShell({ appName, onImportPhoto, mountBoard }: AppShellProps) {
  useShortcuts(useEditorStore());
  const aligning = useEditor((s) => s.align !== null);
  return (
    <div className="shell">
      <Header appName={appName} onImportPhoto={onImportPhoto} />
      <nav className="shell__toolbar" aria-label="Tools" />
      <BoardView mountBoard={mountBoard} />
      <LayerPanel>{aligning ? <AlignPanel /> : null}</LayerPanel>
      <StatusBar />
    </div>
  );
}
