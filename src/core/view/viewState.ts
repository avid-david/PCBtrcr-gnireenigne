import { DEFAULT_VIEWPORT, fitToRect, type ScreenSize, type Viewport } from '../geometry/viewport';
import { projectBounds } from '../alignment/bounds';
import type { AnchorId } from '../model/features';
import type { LayerId, Project } from '../model/project';

/**
 * How the board is being looked at. Not part of the project file: switching layers or
 * zooming is not an edit.
 */
export interface ViewState {
  readonly activeLayerId: LayerId;
  readonly viewport: Viewport;
  readonly screen: ScreenSize;
  /** Opacity (0–1) of the inactive layer drawn over the active one. */
  readonly overlayOpacity: number;
  readonly hiddenPhotos: readonly LayerId[];
  /** Content hidden per layer (SPEC "Layers and overlay"), as `layerId:content` keys. */
  readonly hiddenContent: readonly string[];
  /** A member anchor of the net shown highlighted on every layer (SPEC F5), or null. */
  readonly highlight: AnchorId | null;
  /** Unit lengths are shown and typed in; the model is always in mm. */
  readonly units: 'mm' | 'mil';
}

/** What can be shown or hidden per layer besides its photo. */
export type LayerContent = 'copper' | 'silk' | 'text';

const contentKey = (id: LayerId, content: LayerContent) => `${id}:${content}`;

export const DEFAULT_OVERLAY_OPACITY = 0.5;

/** Initial view of a project: first layer active, default zoom. */
export function createViewState(project: Project): ViewState {
  return {
    activeLayerId: project.layers[0]?.id ?? '',
    viewport: DEFAULT_VIEWPORT,
    screen: { width: 0, height: 0 },
    overlayOpacity: DEFAULT_OVERLAY_OPACITY,
    hiddenPhotos: [],
    hiddenContent: [],
    highlight: null,
    units: 'mm',
  };
}

/** Makes the next layer in the list active, wrapping around. */
export function cycleActiveLayer(view: ViewState, project: Project): ViewState {
  const ids = project.layers.map((l) => l.id);
  const next = ids[(ids.indexOf(view.activeLayerId) + 1) % ids.length];
  return next === undefined ? view : { ...view, activeLayerId: next };
}

/** Makes the given layer active if it exists in the project. */
export function setActiveLayer(view: ViewState, project: Project, id: LayerId): ViewState {
  return project.layers.some((l) => l.id === id) ? { ...view, activeLayerId: id } : view;
}

/** Sets the overlay opacity, clamped to 0–1. */
export const setOverlayOpacity = (view: ViewState, opacity: number): ViewState => ({
  ...view,
  overlayOpacity: Math.min(1, Math.max(0, opacity)),
});

/** Shows or hides a layer's photo. */
export function setPhotoVisible(view: ViewState, id: LayerId, visible: boolean): ViewState {
  const others = view.hiddenPhotos.filter((hidden) => hidden !== id);
  return { ...view, hiddenPhotos: visible ? others : [...others, id] };
}

/** Whether a layer's photo is currently shown. */
export const isPhotoVisible = (view: ViewState, id: LayerId): boolean =>
  !view.hiddenPhotos.includes(id);

/** Fits all photos into the screen; keeps the view when there is nothing to fit or no screen. */
export function fitToView(view: ViewState, project: Project): ViewState {
  const bounds = projectBounds(project);
  if (bounds === null || view.screen.width <= 0 || view.screen.height <= 0) {
    return view;
  }
  return { ...view, viewport: fitToRect(bounds, view.screen) };
}

/** Shows or hides copper, silkscreen or text of a layer. */
export function setContentVisible(
  view: ViewState,
  target: { readonly layerId: LayerId; readonly content: LayerContent },
  visible: boolean,
): ViewState {
  const key = contentKey(target.layerId, target.content);
  const others = view.hiddenContent.filter((hidden) => hidden !== key);
  return { ...view, hiddenContent: visible ? others : [...others, key] };
}

/** Whether copper, silkscreen or text of a layer is shown. */
export const isContentVisible = (view: ViewState, id: LayerId, content: LayerContent): boolean =>
  !view.hiddenContent.includes(contentKey(id, content));

/** Highlights the net containing `anchor`; highlighting the same net again clears it. */
export const toggleHighlight = (view: ViewState, anchor: AnchorId | null): ViewState => ({
  ...view,
  highlight: anchor === null || view.highlight === anchor ? null : anchor,
});
