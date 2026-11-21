import './theme.css';
import { useMemo } from 'react';
import type { LayerId } from '../core/model/project';
import { AlignPanel } from './AlignPanel';
import { BoardView } from './BoardView';
import { Header } from './Header';
import { Inspector } from './Inspector';
import { LayerPanel } from './LayerPanel';
import { openProjectPicker, type ProjectFileActions } from './projectFileActions';
import { RecoveryBanner } from './ProjectFileControls';
import { always, useShortcuts, type ShortcutMap } from './shortcuts';
import { StatusBar } from './StatusBar';
import { useEditor, useEditorStore } from './store';
import { Toolbar } from './Toolbar';

export interface AppShellProps {
  readonly appName: string;
  readonly onImportPhoto: (layerId: LayerId, file: File) => void;
  readonly mountBoard: (host: HTMLElement) => () => void;
  readonly files: ProjectFileActions;
}

/** Application frame. Expects an `EditorStoreContext` provider above it. */
export function AppShell({ appName, onImportPhoto, mountBoard, files }: AppShellProps) {
  const fileShortcuts = useMemo<ShortcutMap>(
    () => ({
      'Ctrl+s': always(() => {
        files.saveProject();
      }),
      'Ctrl+o': always(openProjectPicker),
    }),
    [files],
  );
  useShortcuts(useEditorStore(), fileShortcuts);
  const aligning = useEditor((s) => s.tool.id === 'align');
  return (
    <div className="shell">
      <Header appName={appName} onImportPhoto={onImportPhoto} files={files} />
      <RecoveryBanner actions={files} />
      <Toolbar />
      <BoardView mountBoard={mountBoard} />
      <LayerPanel>{aligning ? <AlignPanel /> : <Inspector />}</LayerPanel>
      <StatusBar />
    </div>
  );
}
