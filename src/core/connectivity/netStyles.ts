import { anchorIndex, anchorsOf } from '../model/anchors';
import type { AnchorId, Feature } from '../model/features';
import type { NetStyle, Project } from '../model/project';
import { netColor } from './netColors';
import { deriveNets, type Net, type NetId, type Nets } from './nets';

// Names, colours and locks the user gives nets are stored against one member anchor and follow
// the net through edits (docs/adr/0008). This module finds a net's style and keeps the styles
// consistent after each edit: one per net, the larger net winning a merge.

/** How a net is shown: its name, colour and whether it is locked. */
export interface NetAppearance {
  readonly name: string;
  readonly color: number;
  readonly locked: boolean;
  /** Whether the user changed any of it (else everything is automatic). */
  readonly styled: boolean;
}

const styleIndexes = new WeakMap<Project, ReadonlyMap<NetId, NetStyle>>();

/** The style of each net (the first one listed wins until the next edit reconciles them). */
function styleIndex(project: Project): ReadonlyMap<NetId, NetStyle> {
  const cached = styleIndexes.get(project);
  if (cached !== undefined) {
    return cached;
  }
  const nets = deriveNets(project);
  const index = new Map<NetId, NetStyle>();
  for (const style of project.netStyles) {
    const net = nets.netOfAnchor(style.anchor);
    if (net !== undefined && !index.has(net.id)) {
      index.set(net.id, style);
    }
  }
  styleIndexes.set(project, index);
  return index;
}

/** The user's style of a net, if any. */
export const netStyleOf = (project: Project, net: Net): NetStyle | undefined =>
  styleIndex(project).get(net.id);

/** Name, colour and lock of a net: the user's choices, else "Net 7" and the hashed colour. */
export function netAppearance(project: Project, net: Net): NetAppearance {
  const style = netStyleOf(project, net);
  return {
    name: style?.name ?? `Net ${String(net.number)}`,
    color: style?.color ?? netColor(net.id),
    locked: style?.locked ?? false,
    styled: style !== undefined,
  };
}

/** Whether a feature touches a locked net (then it cannot be selected, moved or deleted). */
export function isFeatureLocked(project: Project, f: Feature): boolean {
  if (project.netStyles.every((s) => !s.locked)) {
    return false;
  }
  const nets = deriveNets(project);
  const ids = [...anchorsOf(f).map((a) => a.id), ...(f.kind === 'plane' ? f.attached : [])];
  return ids.some((id) => {
    const net = nets.netOfAnchor(id);
    return net !== undefined && netAppearance(project, net).locked;
  });
}

/**
 * How durable an anchor is as a style's home (lower is better): component pads outlive the
 * traces drawn to them, and trace points come and go while tracing.
 */
function durability(project: Project, id: AnchorId): number {
  const anchor = anchorIndex(project).get(id);
  const kind = project.features.find((f) => f.id === anchor?.featureId)?.kind;
  if (kind === 'component') {
    return 0;
  }
  return kind === 'trace' ? 2 : 1;
}

/** The most durable member of a net, oldest first among equals. */
const homeAnchor = (project: Project, anchors: readonly AnchorId[]): AnchorId | undefined =>
  anchors.reduce<AnchorId | undefined>(
    (best, id) =>
      best === undefined || durability(project, id) < durability(project, best) ? id : best,
    undefined,
  );

export type NetStylePatch = Partial<Pick<NetStyle, 'name' | 'color' | 'locked'>>;

const isEmpty = (s: NetStyle) => s.name === null && s.color === null && !s.locked;

/**
 * The project with the style of the net containing `member` changed. A net without a style
 * gets one on its most durable anchor; a style with nothing left set is removed.
 */
export function setNetStyle(project: Project, member: AnchorId, patch: NetStylePatch): Project {
  const net = deriveNets(project).netOfAnchor(member);
  const home = net === undefined ? undefined : homeAnchor(project, net.anchors);
  if (net === undefined || home === undefined) {
    return project;
  }
  const current = netStyleOf(project, net);
  const base: NetStyle = current ?? { anchor: home, name: null, color: null, locked: false };
  const next = { ...base, ...patch };
  const others = project.netStyles.filter((s) => s !== current);
  return { ...project, netStyles: isEmpty(next) ? others : [...others, next] };
}

/** What an edit did to net styles: names of merged nets whose style gave way to a larger one. */
export interface MergeReport {
  readonly kept: string;
  readonly dropped: readonly string[];
}

interface Candidate {
  readonly style: NetStyle;
  /** Size of the style's net before the edit, which decides merges. */
  readonly sizeBefore: number;
  readonly nameBefore: string;
}

/** A style whose anchor was deleted moves to the most durable surviving member of its old net. */
function rehome(style: NetStyle, before: Project, after: Project): NetStyle | null {
  const afterIndex = anchorIndex(after);
  if (afterIndex.has(style.anchor)) {
    return style;
  }
  const old = deriveNets(before).netOfAnchor(style.anchor);
  const survivors = (old?.anchors ?? []).filter((id) => afterIndex.has(id));
  const home = homeAnchor(after, survivors);
  return home === undefined ? null : { ...style, anchor: home };
}

function candidateOf(style: NetStyle, before: Project, beforeNets: Nets): Candidate {
  const net = beforeNets.netOfAnchor(style.anchor);
  return {
    style,
    sizeBefore: net?.anchors.length ?? 0,
    nameBefore: net === undefined ? (style.name ?? '') : netAppearance(before, net).name,
  };
}

/** Groups the surviving styles by the net they are in after the edit. */
function groupByNet(candidates: readonly Candidate[], after: Project): Candidate[][] {
  const nets = deriveNets(after);
  const groups = new Map<NetId, Candidate[]>();
  for (const c of candidates) {
    const id = nets.netOfAnchor(c.style.anchor)?.id ?? c.style.anchor;
    groups.set(id, [...(groups.get(id) ?? []), c]);
  }
  return [...groups.values()];
}

/** The larger net's style wins (the earlier listed one on a tie). */
const winner = (group: readonly Candidate[]): Candidate | undefined =>
  group.reduce<Candidate | undefined>(
    (best, c) => (best === undefined || c.sizeBefore > best.sizeBefore ? c : best),
    undefined,
  );

/**
 * Keeps net styles consistent after an edit (docs/adr/0008): styles on deleted anchors move to
 * another member of their net, and when nets merge, the style of the net that was larger before
 * the edit stays and the others are dropped. Returns the reconciled project and what merged.
 */
export function reconcileNetStyles(
  before: Project,
  after: Project,
): { readonly project: Project; readonly merges: readonly MergeReport[] } {
  if (after.netStyles.length === 0) {
    return { project: after, merges: [] };
  }
  const beforeNets = deriveNets(before);
  const moved = after.netStyles.flatMap((s) => {
    const home = rehome(s, before, after);
    return home === null ? [] : [home];
  });
  const groups = groupByNet(
    moved.map((s) => candidateOf(s, before, beforeNets)),
    after,
  );
  const kept = groups.flatMap((g) => {
    const w = winner(g);
    return w === undefined ? [] : [w.style];
  });
  const merges = groups
    .filter((g) => g.length > 1)
    .map((g) => ({
      kept: winner(g)?.nameBefore ?? '',
      dropped: g.filter((c) => c !== winner(g)).map((c) => c.nameBefore),
    }));
  const same =
    kept.length === after.netStyles.length && kept.every((s, i) => s === after.netStyles[i]);
  return { project: same ? after : { ...after, netStyles: kept }, merges };
}

/** Describes merges for the status bar, e.g. "Joined GND into VCC (the larger net)." */
export const describeMerges = (merges: readonly MergeReport[]): string | null =>
  merges.length === 0
    ? null
    : merges
        .map(
          (m) =>
            `Joined ${m.dropped.join(', ')} into ${m.kept} (the larger net keeps its name and colour).`,
        )
        .join(' ');
