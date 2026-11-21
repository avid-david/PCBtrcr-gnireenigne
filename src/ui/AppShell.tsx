import './theme.css';
import { useMemo, useState } from 'react';
import type { LayerId } from '../core/model/project';
import { AlignPanel } from './AlignPanel';
import { BoardView } from './BoardView';
import { Header } from './Header';
import { Inspector } from './Inspector';
import { ShortcutsHelp } from './ShortcutsHelp';
import { SidePanel } from './SidePanel';
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

/** Shortcuts that need the app: file access and the help overlay; installs all shortcuts. */
function useAppShortcuts(
  files: ProjectFileActions,
  setHelp: (update: (open: boolean) => boolean) => void,
): ShortcutMap {
  const appShortcuts = useMemo<ShortcutMap>(
    () => ({
      'Ctrl+s': always('Save the project', () => {
        files.saveProject();
      }),
      'Ctrl+o': always('Open a project', openProjectPicker),
      '?': always('Show or hide this list', () => {
        setHelp((open) => !open);
      }),
    }),
    [files, setHelp],
  );
  useShortcuts(useEditorStore(), appShortcuts);
  return appShortcuts;
}

/** Application frame. Expects an `EditorStoreContext` provider above it. */
export function AppShell({ appName, onImportPhoto, mountBoard, files }: AppShellProps) {
  const [help, setHelp] = useState(false);
  const appShortcuts = useAppShortcuts(files, setHelp);
  const aligning = useEditor((s) => s.tool.id === 'align');
  return (
    <div className="shell">
      <Header
        appName={appName}
        onImportPhoto={onImportPhoto}
        files={files}
        onHelp={() => {
          setHelp(true);
        }}
      />
      <RecoveryBanner actions={files} />
      <Toolbar />
      <BoardView mountBoard={mountBoard} />
      <SidePanel onExport={files.exportProject}>
        {aligning ? <AlignPanel /> : <Inspector />}
      </SidePanel>
      <StatusBar />
      {help ? (
        <ShortcutsHelp
          extra={appShortcuts}
          onClose={() => {
            setHelp(false);
          }}
        />
      ) : null}
    </div>
  );
}
