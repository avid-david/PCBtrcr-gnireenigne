import { anchorIndex, anchorsOf } from '../model/anchors';
import type { Feature } from '../model/features';
import type { Project } from '../model/project';

// Checks a file's cross-references after its shape was validated: a damaged or hand-edited file
// must not load with ties to nothing (docs/adr/0006, 0007). Each returns a message or null.

type Check = (project: Project) => string | null;

const danglingTies: Check = (project) => {
  const anchors = anchorIndex(project);
  const dangling = [...anchors.values()].find((a) => a.boundTo !== null && !anchors.has(a.boundTo));
  return dangling === undefined ? null : `trace point ${dangling.id} is tied to a missing anchor`;
};

const strayMatches: Check = (project) => {
  const layerIds = new Set(project.layers.map((l) => l.id));
  const stray = project.matches.find((m) => Object.keys(m.points).some((id) => !layerIds.has(id)));
  return stray === undefined ? null : `matched point ${stray.id} names a missing layer`;
};

const strayAttachments: Check = (project) => {
  const anchors = anchorIndex(project);
  const plane = project.features.find(
    (f) => f.kind === 'plane' && f.attached.some((id) => !anchors.has(id)),
  );
  return plane === undefined ? null : `plane ${plane.id} is attached to a missing anchor`;
};

/** Every id a feature introduces: its own and its anchors' (a via's anchor is the via). */
const idsOf = (f: Feature): string[] => [
  f.id,
  ...anchorsOf(f)
    .map((a) => a.id)
    .filter((id) => id !== f.id),
];

const duplicateIds: Check = (project) => {
  const seen = new Set<string>();
  const duplicate = project.features.flatMap(idsOf).find((id) => {
    const repeated = seen.has(id);
    seen.add(id);
    return repeated;
  });
  return duplicate === undefined ? null : `the id ${duplicate} is used twice`;
};

const unknownLayers: Check = (project) => {
  const layerIds = new Set(project.layers.map((l) => l.id));
  const stray = project.features.find(
    (f) => 'layerId' in f && f.layerId !== null && !layerIds.has(f.layerId),
  );
  return stray === undefined ? null : `${stray.kind} ${stray.id} is on a missing layer`;
};

const CHECKS: readonly Check[] = [
  duplicateIds,
  danglingTies,
  strayAttachments,
  strayMatches,
  unknownLayers,
];

/** The first broken reference in the project, or null if all resolve. */
export const brokenReference = (project: Project): string | null =>
  CHECKS.reduce<string | null>((found, check) => found ?? check(project), null);
