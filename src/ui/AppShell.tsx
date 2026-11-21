import './theme.css';
import type { LayerId } from '../core/model/project';
import { AlignPanel } from './AlignPanel';
import { BoardView } from './BoardView';
import { Header } from './Header';
import { Inspector } from './Inspector';
import { LayerPanel } from './LayerPanel';
import { useShortcuts } from './shortcuts';
import { StatusBar } from './StatusBar';
import { useEditor, useEditorStore } from './store';
import { Toolbar } from './Toolbar';

export interface AppShellProps {
  readonly appName: string;
  readonly onImportPhoto: (layerId: LayerId, file: File) => void;
  readonly mountBoard: (host: HTMLElement) => () => void;
}

/** Application frame. Expects an `EditorStoreContext` provider above it. */
export function AppShell({ appName, onImportPhoto, mountBoard }: AppShellProps) {
  useShortcuts(useEditorStore());
  const aligning = useEditor((s) => s.tool.id === 'align');
  return (
    <div className="shell">
      <Header appName={appName} onImportPhoto={onImportPhoto} />
      <Toolbar />
      <BoardView mountBoard={mountBoard} />
      <LayerPanel>{aligning ? <AlignPanel /> : <Inspector />}</LayerPanel>
      <StatusBar />
    </div>
  );
}
