import { deriveNets, type Net } from '../connectivity/nets';
import { netAppearance } from '../connectivity/netStyles';
import { anchorIndex } from '../model/anchors';
import type { Feature } from '../model/features';
import type { Project } from '../model/project';

/** One net as exported and listed: its look and its members (docs/adr/0008). */
export interface NetlistEntry {
  readonly net: Net;
  readonly name: string;
  readonly color: number;
  readonly locked: boolean;
  /** Component pins as "R1.2"; other anchors as "via:<id>", "pad:<id>"… Trace points are left out. */
  readonly members: readonly string[];
}

/** How an anchor is named in a netlist, or null for anchors that are not listed (trace points). */
function memberName(feature: Feature, anchorId: string): string | null {
  if (feature.kind === 'trace') {
    return null;
  }
  if (feature.kind === 'component') {
    const pad = feature.pads.find((p) => p.id === anchorId);
    return `${feature.designator === '' ? '?' : feature.designator}.${pad?.number ?? '?'}`;
  }
  return `${feature.kind}:${feature.id}`;
}

const byName = new Intl.Collator(undefined, { numeric: true }).compare;

/** Nets with at least one listed member, sorted by name ("Net 2" before "Net 10"). */
export function netlist(project: Project): NetlistEntry[] {
  const anchors = anchorIndex(project);
  const features = new Map(project.features.map((f) => [f.id, f]));
  const memberOf = (id: string) => {
    const feature = features.get(anchors.get(id)?.featureId ?? '');
    return feature === undefined ? null : memberName(feature, id);
  };
  return deriveNets(project)
    .nets.map((net) => ({
      net,
      ...netAppearance(project, net),
      members: net.anchors.flatMap((id) => {
        const name = memberOf(id);
        return name === null ? [] : [name];
      }),
    }))
    .filter((e) => e.members.length > 0)
    .map(({ net, name, color, locked, members }) => ({ net, name, color, locked, members }))
    .sort((a, b) => byName(a.name, b.name));
}
