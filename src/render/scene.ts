import { layerTransform } from '../core/alignment/alignment';
import type { Mat3 } from '../core/geometry/mat3';
import type { Vec2 } from '../core/geometry/vec2';
import type { Viewport } from '../core/geometry/viewport';
import type { ImageId, Layer, LayerId, Project } from '../core/model/project';
import { isPhotoVisible, type ViewState } from '../core/view/viewState';
import { previewProject, type AlignState } from '../tools/align';
import { alignMarkers, boardOutline, type SceneMarker } from './alignOverlay';

/** One photo to draw: which image, where it sits in board space and how opaque it is. */
export interface SceneLayer {
  readonly layerId: LayerId;
  readonly imageId: ImageId;
  /** Image pixels → board mm; may be projective once the layer is aligned. */
  readonly imageToBoard: Mat3;
  readonly opacity: number;
}

/** Everything a renderer needs for one frame. Layers are ordered back to front. */
export interface Scene {
  readonly viewport: Viewport;
  readonly layers: readonly SceneLayer[];
  /** Board outline in mm, or `null` while the board size is unknown. */
  readonly outline: readonly Vec2[] | null;
  /** Alignment points (align mode only). */
  readonly markers: readonly SceneMarker[];
}

export interface SceneInput {
  readonly project: Project;
  readonly view: ViewState;
  /** Align mode state, or `null` when align mode is off. */
  readonly align: AlignState | null;
}

function toSceneLayer(project: Project, layer: Layer, opacity: number): SceneLayer | null {
  const transform = layerTransform(project, layer.id);
  if (layer.image === null || transform === null || opacity <= 0) {
    return null;
  }
  return { layerId: layer.id, imageId: layer.image.id, imageToBoard: transform, opacity };
}

/**
 * The active layer is drawn opaque at the back; the other layers are drawn over it with the
 * overlay opacity (SPEC "Layers and overlay"). Hidden photos are left out. While a point is
 * dragged in align mode, everything is drawn as if it were dropped (live preview).
 */
export function buildScene({ project: saved, view, align }: SceneInput): Scene {
  const project = align === null ? saved : previewProject(saved, align);
  const visible = project.layers.filter((l) => isPhotoVisible(view, l.id));
  const active = visible.filter((l) => l.id === view.activeLayerId);
  const others = visible.filter((l) => l.id !== view.activeLayerId);
  const layers = [
    ...active.map((l) => toSceneLayer(project, l, 1)),
    ...others.map((l) => toSceneLayer(project, l, view.overlayOpacity)),
  ].filter((l): l is SceneLayer => l !== null);
  return {
    viewport: view.viewport,
    layers,
    outline: boardOutline(project),
    markers: align === null ? [] : alignMarkers(project, align, view.activeLayerId),
  };
}
