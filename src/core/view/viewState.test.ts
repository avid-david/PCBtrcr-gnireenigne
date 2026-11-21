import { describe, expect, it } from 'vitest';
import { setLayerImage } from '../commands/command';
import { DEFAULT_VIEWPORT } from '../geometry/viewport';
import { createProject, type Project } from '../model/project';
import {
  DEFAULT_OVERLAY_OPACITY,
  createViewState,
  cycleActiveLayer,
  fitToView,
  isPhotoVisible,
  setActiveLayer,
  setOverlayOpacity,
  setPhotoVisible,
} from './viewState';

const withPhoto = (project: Project): Project =>
  setLayerImage('top', {
    id: 'i',
    fileName: 'a.png',
    mimeType: 'image/png',
    widthPx: 1000,
    heightPx: 500,
  }).execute(project);

describe('view state', () => {
  const project = createProject();

  it('starts on the first layer with the default overlay opacity', () => {
    const view = createViewState(project);
    expect(view.activeLayerId).toBe('top');
    expect(view.overlayOpacity).toBe(DEFAULT_OVERLAY_OPACITY);
    expect(view.viewport).toBe(DEFAULT_VIEWPORT);
  });

  it('copes with a project without layers', () => {
    const empty = { board: null, layers: [], matches: [], features: [] };
    const view = createViewState(empty);
    expect(view.activeLayerId).toBe('');
    expect(cycleActiveLayer(view, empty)).toBe(view);
  });

  it('cycles through layers and wraps around', () => {
    const once = cycleActiveLayer(createViewState(project), project);
    expect(once.activeLayerId).toBe('bottom');
    expect(cycleActiveLayer(once, project).activeLayerId).toBe('top');
  });

  it('sets the active layer only to existing layers', () => {
    const view = createViewState(project);
    expect(setActiveLayer(view, project, 'bottom').activeLayerId).toBe('bottom');
    expect(setActiveLayer(view, project, 'inner1')).toBe(view);
  });

  it('clamps overlay opacity to 0–1', () => {
    const view = createViewState(project);
    expect(setOverlayOpacity(view, 1.5).overlayOpacity).toBe(1);
    expect(setOverlayOpacity(view, -1).overlayOpacity).toBe(0);
    expect(setOverlayOpacity(view, 0.25).overlayOpacity).toBe(0.25);
  });

  it('hides and shows photos per layer', () => {
    const hidden = setPhotoVisible(createViewState(project), 'bottom', false);
    expect(isPhotoVisible(hidden, 'bottom')).toBe(false);
    expect(isPhotoVisible(hidden, 'top')).toBe(true);
    expect(setPhotoVisible(hidden, 'bottom', false).hiddenPhotos).toEqual(['bottom']);
    expect(isPhotoVisible(setPhotoVisible(hidden, 'bottom', true), 'bottom')).toBe(true);
  });

  it('fits photos to the screen once both exist', () => {
    const view = createViewState(project);
    expect(fitToView(view, withPhoto(project))).toBe(view);
    expect(fitToView({ ...view, screen: { width: 800, height: 600 } }, project).viewport).toBe(
      DEFAULT_VIEWPORT,
    );
    const fitted = fitToView({ ...view, screen: { width: 800, height: 600 } }, withPhoto(project));
    expect(fitted.viewport.zoom).toBeCloseTo(7.2);
  });
});
