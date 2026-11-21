import { DEFAULT_VIEWPORT, fitToRect, type ScreenSize, type Viewport } from '../geometry/viewport';
import { projectBounds } from '../alignment/initialPlacement';
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
}

export const DEFAULT_OVERLAY_OPACITY = 0.5;

/** Initial view of a project: first layer active, default zoom. */
export function createViewState(project: Project): ViewState {
  return {
    activeLayerId: project.layers[0]?.id ?? '',
    viewport: DEFAULT_VIEWPORT,
    screen: { width: 0, height: 0 },
    overlayOpacity: DEFAULT_OVERLAY_OPACITY,
    hiddenPhotos: [],
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
