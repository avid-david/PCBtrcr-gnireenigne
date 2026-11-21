import type { Vec2 } from '../geometry/vec2';
import type { Corner, LayerId, MatchId, Project } from './project';
import { updateLayer } from './project';

/** Identifies one clicked alignment point: a corner of a layer, or one side of a match. */
export type PointRef =
  | { readonly kind: 'corner'; readonly layerId: LayerId; readonly corner: Corner }
  | { readonly kind: 'match'; readonly layerId: LayerId; readonly matchId: MatchId };

interface PointKind<K extends PointRef['kind']> {
  get(project: Project, ref: Extract<PointRef, { kind: K }>): Vec2 | undefined;
  move(project: Project, ref: Extract<PointRef, { kind: K }>, px: Vec2): Project;
  remove(project: Project, ref: Extract<PointRef, { kind: K }>): Project;
}

const cornerKind: PointKind<'corner'> = {
  get: (project, ref) => project.layers.find((l) => l.id === ref.layerId)?.corners[ref.corner],
  move: (project, ref, px) =>
    updateLayer(project, ref.layerId, (l) => ({
      ...l,
      corners: { ...l.corners, [ref.corner]: px },
    })),
  remove: (project, ref) =>
    updateLayer(project, ref.layerId, (l) => ({
      ...l,
      corners: Object.fromEntries(Object.entries(l.corners).filter(([c]) => c !== ref.corner)),
    })),
};

const matchKind: PointKind<'match'> = {
  get: (project, ref) => project.matches.find((m) => m.id === ref.matchId)?.points[ref.layerId],
  move: (project, ref, px) => ({
    ...project,
    matches: project.matches.map((m) =>
      m.id === ref.matchId ? { ...m, points: { ...m.points, [ref.layerId]: px } } : m,
    ),
  }),
  // A match needs at least two sides, so removing one side removes the whole match.
  remove: (project, ref) => ({
    ...project,
    matches: project.matches.filter((m) => m.id !== ref.matchId),
  }),
};

const kinds: { readonly [K in PointRef['kind']]: PointKind<K> } = {
  corner: cornerKind,
  match: matchKind,
};

const kindOf = (ref: PointRef) => kinds[ref.kind] as PointKind<PointRef['kind']>;

/** Image-pixel position of a point, or `undefined` if it does not exist. */
export const getPoint = (project: Project, ref: PointRef): Vec2 | undefined =>
  kindOf(ref).get(project, ref);

/** Project with the point moved (or created, for corners) to `px`. */
export const movePoint = (project: Project, ref: PointRef, px: Vec2): Project =>
  kindOf(ref).move(project, ref, px);

/** Project without the point. */
export const removePoint = (project: Project, ref: PointRef): Project =>
  kindOf(ref).remove(project, ref);

/** Whether two references name the same point. */
export function samePoint(a: PointRef, b: PointRef): boolean {
  if (a.kind === 'corner' && b.kind === 'corner') {
    return a.layerId === b.layerId && a.corner === b.corner;
  }
  if (a.kind === 'match' && b.kind === 'match') {
    return a.layerId === b.layerId && a.matchId === b.matchId;
  }
  return false;
}

/** All points clicked on one layer's photo. */
export function pointsOnLayer(project: Project, layerId: LayerId): { ref: PointRef; px: Vec2 }[] {
  const layer = project.layers.find((l) => l.id === layerId);
  const corners = Object.entries(layer?.corners ?? {}).map(([corner, px]) => ({
    ref: { kind: 'corner', layerId, corner: corner as Corner } as const,
    px,
  }));
  const matches = project.matches.flatMap((m) => {
    const px = m.points[layerId];
    return px === undefined
      ? []
      : [{ ref: { kind: 'match', layerId, matchId: m.id } as const, px }];
  });
  return [...corners, ...matches];
}
