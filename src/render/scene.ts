import { layerTransform } from '../core/alignment/alignment';
import type { Mat3 } from '../core/geometry/mat3';
import type { Rect } from '../core/geometry/rect';
import type { Vec2 } from '../core/geometry/vec2';
import type { Viewport } from '../core/geometry/viewport';
import { featureBounds } from '../core/model/featureKinds';
import type { FeatureId } from '../core/model/features';
import type { ImageId, Layer, LayerId, Project } from '../core/model/project';
import { isPhotoVisible, type ViewState } from '../core/view/viewState';
import { toolOverlay, toolPreview, type ActiveTool } from '../tools/registry';
import type { ToolSettings } from '../tools/settings';
import type { ToolOverlay } from '../tools/tool';
import { alignMarkers, boardOutline, type SceneMarker } from './alignOverlay';
import { featureScene, selectedFeatures, type FeatureDrawable } from './featureScene';
import type { TextItem } from './textItems';

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
  /** Copper in drawing order; the same array while nothing changed (cheap to compare). */
  readonly features: readonly FeatureDrawable[];
  /** Silkscreen text, notes and designators; the same array while nothing changed. */
  readonly texts: readonly TextItem[];
  /** Bounds of selected features, for the highlight. */
  readonly selection: readonly Rect[];
  /** Alignment points (align tool only). */
  readonly markers: readonly SceneMarker[];
  readonly toolOverlay: ToolOverlay;
}

export interface SceneInput {
  readonly project: Project;
  readonly view: ViewState;
  readonly tool: ActiveTool;
  readonly selection: readonly FeatureId[];
  readonly settings: ToolSettings;
}

function toSceneLayer(project: Project, layer: Layer, opacity: number): SceneLayer | null {
  const transform = layerTransform(project, layer.id);
  if (layer.image === null || transform === null || opacity <= 0) {
    return null;
  }
  return { layerId: layer.id, imageId: layer.image.id, imageToBoard: transform, opacity };
}

/** Photos: the active layer opaque at the back, the others over it at the overlay opacity. */
function photoLayers(project: Project, view: ViewState): SceneLayer[] {
  const visible = project.layers.filter((l) => isPhotoVisible(view, l.id));
  const active = visible.filter((l) => l.id === view.activeLayerId);
  const others = visible.filter((l) => l.id !== view.activeLayerId);
  return [
    ...active.map((l) => toSceneLayer(project, l, 1)),
    ...others.map((l) => toSceneLayer(project, l, view.overlayOpacity)),
  ].filter((l): l is SceneLayer => l !== null);
}

/**
 * Everything to draw. While a tool previews an edit (dragging features or an alignment point),
 * the scene shows the project as if the edit were done.
 */
export function buildScene(input: SceneInput): Scene {
  const { view, tool } = input;
  const project = toolPreview(tool, input.project);
  const ctx = {
    project: input.project,
    activeLayerId: view.activeLayerId,
    selection: input.selection,
    settings: input.settings,
    units: view.units,
    newId: () => '',
  };
  const features = featureScene(project, view);
  return {
    viewport: view.viewport,
    layers: photoLayers(project, view),
    outline: boardOutline(project),
    features: features.drawables,
    texts: features.texts,
    selection: selectedFeatures(project, input.selection).map((f) => featureBounds(f, project)),
    markers: tool.id === 'align' ? alignMarkers(project, tool.state, view.activeLayerId) : [],
    toolOverlay: toolOverlay(tool, ctx),
  };
}
