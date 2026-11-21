import { apply, invert, type Mat3 } from '../geometry/mat3';
import type { Vec2 } from '../geometry/vec2';
import { pointsOnLayer } from '../model/points';
import { cornerPosition, type Layer, type LayerId, type Project } from '../model/project';
import { fitsFor, type PointFit, type Target } from './fit';
import { solveHomography, type HomographyError } from './homography';
import { unalignedTransform } from './initialPlacement';

export type AlignmentStatus = 'aligned' | 'no-photo' | HomographyError;

export interface LayerAlignment {
  readonly layerId: LayerId;
  readonly status: AlignmentStatus;
  /** Image pixels → board mm, or `null` when the layer is not aligned yet. */
  readonly transform: Mat3 | null;
  /** Points used for the fit; empty when not aligned. */
  readonly fits: readonly PointFit[];
  /** Root-mean-square residual in mm, or `null` when not aligned. */
  readonly rmsMm: number | null;
  /** Number of usable points found (aligned or not). */
  readonly pointCount: number;
}

/** Board positions this layer's points should map to: corners, and matches with aligned layers. */
function targetsFor(project: Project, layer: Layer, solved: ReadonlyMap<LayerId, Mat3>): Target[] {
  const board = project.board;
  return pointsOnLayer(project, layer.id).flatMap(({ ref, px }): Target[] => {
    if (ref.kind === 'corner') {
      return board === null ? [] : [{ ref, from: px, to: cornerPosition(board, ref.corner) }];
    }
    const match = project.matches.find((m) => m.id === ref.matchId);
    const other = Object.entries(match?.points ?? {}).find(
      ([id]) => id !== layer.id && solved.has(id),
    );
    const otherTransform = other === undefined ? undefined : solved.get(other[0]);
    return other === undefined || otherTransform === undefined
      ? []
      : [{ ref, from: px, to: apply(otherTransform, other[1]) }];
  });
}

function alignLayer(
  project: Project,
  layer: Layer,
  solved: ReadonlyMap<LayerId, Mat3>,
): LayerAlignment {
  const targets = targetsFor(project, layer, solved);
  const base = {
    layerId: layer.id,
    transform: null,
    fits: [],
    rmsMm: null,
    pointCount: targets.length,
  };
  if (layer.image === null) {
    return { ...base, status: 'no-photo' };
  }
  const homography = solveHomography(targets);
  if (!homography.ok) {
    return { ...base, status: homography.error };
  }
  return {
    ...base,
    status: 'aligned',
    transform: homography.value,
    ...fitsFor(homography.value, targets),
  };
}

const cache = new WeakMap<Project, ReadonlyMap<LayerId, LayerAlignment>>();

/**
 * Aligns every layer, in list order: a layer can use its board corners and its matches with
 * layers aligned before it (the top layer is the reference, fixed by its corners).
 * Results are cached per project object, which is immutable.
 */
export function solveAlignment(project: Project): ReadonlyMap<LayerId, LayerAlignment> {
  const cached = cache.get(project);
  if (cached !== undefined) {
    return cached;
  }
  const solved = new Map<LayerId, Mat3>();
  const result = new Map<LayerId, LayerAlignment>();
  for (const layer of project.layers) {
    const alignment = alignLayer(project, layer, solved);
    result.set(layer.id, alignment);
    if (alignment.transform !== null) {
      solved.set(layer.id, alignment.transform);
    }
  }
  cache.set(project, result);
  return result;
}

/** Image pixels → board mm for a layer: its alignment, or the unaligned placement; `null` without photo. */
export function layerTransform(project: Project, layerId: LayerId): Mat3 | null {
  const layer = project.layers.find((l) => l.id === layerId);
  const image = layer?.image ?? null;
  if (layer === undefined || image === null) {
    return null;
  }
  const aligned = solveAlignment(project).get(layerId)?.transform;
  return aligned ?? unalignedTransform(image, { mirrored: layer.mirrored, board: project.board });
}

/** Board mm → image pixels on a layer's photo, or `null` without photo or invertible transform. */
export function boardToImage(project: Project, layerId: LayerId, point: Vec2): Vec2 | null {
  const transform = layerTransform(project, layerId);
  const inverse = transform === null ? null : invert(transform);
  return inverse?.ok === true ? apply(inverse.value, point) : null;
}

/** Image pixels on a layer's photo → board mm, or `null` without photo. */
export function imageToBoard(project: Project, layerId: LayerId, px: Vec2): Vec2 | null {
  const transform = layerTransform(project, layerId);
  return transform === null ? null : apply(transform, px);
}
