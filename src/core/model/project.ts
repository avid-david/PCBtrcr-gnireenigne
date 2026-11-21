/** Identifier of a layer. A list, not fixed fields, so 4-layer boards can be added later. */
export type LayerId = string;

/** Copper side a layer belongs to, as seen from the top of the board. */
export type LayerSide = 'top' | 'bottom';

export type ImageId = string;

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
  /** Whether the photo is mirrored horizontally; part of its alignment, never a pixel edit. */
  readonly mirrored: boolean;
}

export interface Project {
  readonly layers: readonly Layer[];
}

export const TOP_LAYER_ID: LayerId = 'top';
export const BOTTOM_LAYER_ID: LayerId = 'bottom';

/** A new, empty two-layer project. The bottom photo is taken from below, so it starts mirrored. */
export function createProject(): Project {
  return {
    layers: [
      { id: TOP_LAYER_ID, name: 'Top', side: 'top', image: null, mirrored: false },
      { id: BOTTOM_LAYER_ID, name: 'Bottom', side: 'bottom', image: null, mirrored: true },
    ],
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
