import {
  reconcileNetStyles,
  setNetStyle,
  type MergeReport,
  type NetStylePatch,
} from '../connectivity/netStyles';
import type { AnchorId } from '../model/features';
import type { Command } from './command';

/** Renames, recolours, locks or resets the net containing `member`. */
export const styleNet = (member: AnchorId, patch: NetStylePatch): Command => ({
  label: 'locked' in patch ? (patch.locked ? 'Lock net' : 'Unlock net') : 'Edit net',
  execute: (project) => setNetStyle(project, member, patch),
});

/** Clears the name, colour and lock of the net containing `member`. */
export const resetNetStyle = (member: AnchorId): Command => ({
  label: 'Reset net',
  execute: (project) => setNetStyle(project, member, { name: null, color: null, locked: false }),
});

/**
 * The command with net styles reconciled in the same undo step (docs/adr/0008); merges are
 * reported to `onMerge` so the editor can tell the user which net kept its name.
 */
export const withNetStyles = (
  command: Command,
  onMerge: (merges: readonly MergeReport[]) => void,
): Command => ({
  label: command.label,
  execute: (project) => {
    const result = reconcileNetStyles(project, command.execute(project));
    onMerge(result.merges);
    return result.project;
  },
});
