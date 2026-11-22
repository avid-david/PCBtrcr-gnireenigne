import { distance } from '../geometry/distance';
import type { Vec2 } from '../geometry/vec2';
import type { Feature, FeatureId, Via } from '../model/features';
import type { LayerId, Project } from '../model/project';
import { boardToImage } from './alignment';

// Landmarks from overlapping vias (SPEC F9, docs/adr/0010): a via placed next to an existing one
// is usually the same hole, seen in two places because the photos are not quite aligned.

/** Via centres closer than this carry no alignment information, so they offer nothing. */
export const LANDMARK_MIN_OFFSET_MM = 0.05;

/** A newly placed via that may be an existing via seen on another photo. */
export interface LandmarkOffer {
  readonly newViaId: FeatureId;
  readonly existingViaId: FeatureId;
  /** Centre of the existing via (board mm), shown in the offer. */
  readonly at: Vec2;
  /** The layer that was active when the new via was placed: its photo showed the hole there. */
  readonly activeLayerId: LayerId;
  /** The layer whose photo the existing via is assumed to have been placed against. */
  readonly otherLayerId: LayerId;
}

/** Whether two via pads overlap (centres closer than the sum of the radii) without coinciding. */
export function viasOverlap(a: Via, b: Via): boolean {
  const d = distance(a.at, b.at);
  return d >= LANDMARK_MIN_OFFSET_MM && d < (a.padMm + b.padMm) / 2;
}

const hasPhoto = (project: Project, id: LayerId): boolean =>
  project.layers.some((l) => l.id === id && l.image !== null);

const isVia = (f: Feature): f is Via => f.kind === 'via';

const findVia = (project: Project, id: FeatureId): Via | undefined =>
  project.features.filter(isVia).find((v) => v.id === id);

export interface PlacedVia {
  readonly via: Via;
  readonly activeLayerId: LayerId;
}

/**
 * The landmark a via placed on the active layer offers: the nearest other via whose pad it
 * overlaps, when the active layer and another layer both have a photo; `null` otherwise.
 * Visibility and net locks do not matter: accepting never changes the existing via.
 */
export function findLandmark(
  project: Project,
  { via, activeLayerId }: PlacedVia,
): LandmarkOffer | null {
  const other = project.layers.find((l) => l.id !== activeLayerId && l.image !== null);
  if (other === undefined || !hasPhoto(project, activeLayerId)) {
    return null;
  }
  const existing = project.features
    .filter(isVia)
    .filter((v) => v.id !== via.id && viasOverlap(via, v))
    .sort((a, b) => distance(a.at, via.at) - distance(b.at, via.at))[0];
  return existing === undefined
    ? null
    : {
        newViaId: via.id,
        existingViaId: existing.id,
        at: existing.at,
        activeLayerId,
        otherLayerId: other.id,
      };
}

/**
 * The image pixels of an accepted landmark: on the other layer the existing via's centre, on
 * the active layer the new via's centre, each through that layer's current transform. `null`
 * when a via is gone or a photo is missing.
 */
export function landmarkPixels(
  project: Project,
  offer: LandmarkOffer,
): Readonly<Record<LayerId, Vec2>> | null {
  const existing = findVia(project, offer.existingViaId);
  const placed = findVia(project, offer.newViaId);
  const otherPx =
    existing === undefined ? null : boardToImage(project, offer.otherLayerId, existing.at);
  const activePx =
    placed === undefined ? null : boardToImage(project, offer.activeLayerId, placed.at);
  return otherPx === null || activePx === null
    ? null
    : { [offer.otherLayerId]: otherPx, [offer.activeLayerId]: activePx };
}
