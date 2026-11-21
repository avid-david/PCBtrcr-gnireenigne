import type { Project } from '../model/project';
import type { Command } from './command';

/**
 * Undo/redo by snapshots (docs/adr/0005). Commands return a new project that shares every
 * unchanged part with the old one, so keeping the previous project per step is cheap, and undo
 * restores exactly the earlier state — no hand-written inverse per command.
 */
export interface HistoryEntry {
  readonly label: string;
  /** The project to return to when stepping over this entry. */
  readonly project: Project;
}

export interface History {
  /** Most recent last. */
  readonly past: readonly HistoryEntry[];
  /** Next redo first. */
  readonly future: readonly HistoryEntry[];
}

export const EMPTY_HISTORY: History = { past: [], future: [] };

export interface Step {
  readonly project: Project;
  readonly history: History;
}

/** Runs a command and records the step; a new edit discards the redo branch. */
export function execute(project: Project, history: History, command: Command): Step {
  const next = command.execute(project);
  if (next === project) {
    return { project, history };
  }
  return {
    project: next,
    history: { past: [...history.past, { label: command.label, project }], future: [] },
  };
}

/** Steps back to the project before the latest command, or `null` when there is none. */
export function undo(project: Project, history: History): Step | null {
  const entry = history.past.at(-1);
  if (entry === undefined) {
    return null;
  }
  return {
    project: entry.project,
    history: {
      past: history.past.slice(0, -1),
      future: [{ label: entry.label, project }, ...history.future],
    },
  };
}

/** Re-applies the latest undone command, or `null` when there is none. */
export function redo(project: Project, history: History): Step | null {
  const [entry, ...rest] = history.future;
  if (entry === undefined) {
    return null;
  }
  return {
    project: entry.project,
    history: { past: [...history.past, { label: entry.label, project }], future: rest },
  };
}

/** Every project reachable by undo or redo (e.g. to keep their photos' pixels alive). */
export const projectsInHistory = (history: History): Project[] =>
  [...history.past, ...history.future].map((e) => e.project);

/** Label of the step undo would revert, for tooltips. */
export const undoLabel = (history: History): string | null => history.past.at(-1)?.label ?? null;

/** Label of the step redo would re-apply. */
export const redoLabel = (history: History): string | null => history.future[0]?.label ?? null;
