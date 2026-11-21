import type { Vec2 } from '../geometry/vec2';

/** Identifier of a layer. A list, not fixed fields, so 4-layer boards can be added later. */
export type LayerId = string;

/** Copper side a layer belongs to, as seen from the top of the board. */
export type LayerSide = 'top' | 'bottom';

export type ImageId = string;

export type MatchId = string;

/** Board corners as seen from the top, in clicking order. */
export const CORNERS = ['tl', 'tr', 'br', 'bl'] as const;
export type Corner = (typeof CORNERS)[number];

/** Metadata of an imported photo. The pixels are kept outside the model, keyed by `id`. */
export interface SourceImage {
  readonly id: ImageId;
  readonly fileName: string;
  readonly mimeType: string;
  readonly widthPx: number;
  readonly heightPx: number;
}

export interface Layer {
  readonly id: LayerId;
  readonly name: string;
  readonly side: LayerSide;
  readonly image: SourceImage | null;
  /** Whether the unaligned photo is mirrored horizontally; part of its transform, never a pixel edit. */
  readonly mirrored: boolean;
  /** Board corners clicked on this layer's photo, in image pixels. */
  readonly corners: Readonly<Partial<Record<Corner, Vec2>>>;
}

/** The outer size of the board; its top-left corner is the board-space origin. */
export interface Board {
  readonly widthMm: number;
  readonly heightMm: number;
}

/** One physical feature (via, hole, corner…) clicked on the photos of two or more layers. */
export interface PointMatch {
  readonly id: MatchId;
  /** Image-pixel position of the feature, per layer. */
  readonly points: Readonly<Record<LayerId, Vec2>>;
}

/**
 * The project holds only what the user entered. Alignment transforms are derived from the
 * board size, corners and matches (core/alignment), never stored.
 */
export interface Project {
  readonly board: Board | null;
  readonly layers: readonly Layer[];
  readonly matches: readonly PointMatch[];
}

export const TOP_LAYER_ID: LayerId = 'top';
export const BOTTOM_LAYER_ID: LayerId = 'bottom';

/** A new, empty two-layer project. The bottom photo is taken from below, so it starts mirrored. */
export function createProject(): Project {
  return {
    board: null,
    layers: [
      { id: TOP_LAYER_ID, name: 'Top', side: 'top', image: null, mirrored: false, corners: {} },
      {
        id: BOTTOM_LAYER_ID,
        name: 'Bottom',
        side: 'bottom',
        image: null,
        mirrored: true,
        corners: {},
      },
    ],
    matches: [],
  };
}

/** Finds a layer by id. */
export const findLayer = (project: Project, id: LayerId): Layer | undefined =>
  project.layers.find((layer) => layer.id === id);

/** Returns a project with one layer replaced by `update(layer)`; unknown ids leave it unchanged. */
export function updateLayer(
  project: Project,
  id: LayerId,
  update: (layer: Layer) => Layer,
): Project {
  return { ...project, layers: project.layers.map((l) => (l.id === id ? update(l) : l)) };
}

/** Board-space position of a board corner. */
export function cornerPosition(board: Board, corner: Corner): Vec2 {
  const right = corner === 'tr' || corner === 'br';
  const bottom = corner === 'br' || corner === 'bl';
  return { x: right ? board.widthMm : 0, y: bottom ? board.heightMm : 0 };
}
