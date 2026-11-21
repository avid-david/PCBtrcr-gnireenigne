import { describe, expect, it } from 'vitest';
import {
  BOTTOM_LAYER_ID,
  CORNERS,
  TOP_LAYER_ID,
  cornerPosition,
  createProject,
  findLayer,
  updateLayer,
} from './project';

describe('project', () => {
  it('starts with top and bottom layers, the bottom mirrored and no photos', () => {
    const project = createProject();
    expect(project.layers.map((l) => [l.id, l.side, l.mirrored, l.image])).toEqual([
      [TOP_LAYER_ID, 'top', false, null],
      [BOTTOM_LAYER_ID, 'bottom', true, null],
    ]);
  });

  it('findLayer finds by id', () => {
    expect(findLayer(createProject(), BOTTOM_LAYER_ID)?.name).toBe('Bottom');
    expect(findLayer(createProject(), 'inner1')).toBeUndefined();
  });

  it('updateLayer replaces only the matching layer and leaves the input untouched', () => {
    const project = createProject();
    const updated = updateLayer(project, TOP_LAYER_ID, (l) => ({ ...l, mirrored: true }));
    expect(findLayer(updated, TOP_LAYER_ID)?.mirrored).toBe(true);
    expect(findLayer(updated, BOTTOM_LAYER_ID)).toBe(findLayer(project, BOTTOM_LAYER_ID));
    expect(findLayer(project, TOP_LAYER_ID)?.mirrored).toBe(false);
  });
});

describe('cornerPosition', () => {
  it('places corners on the board outline, origin at the top-left', () => {
    const board = { widthMm: 80, heightMm: 50 };
    expect(CORNERS.map((c) => cornerPosition(board, c))).toEqual([
      { x: 0, y: 0 },
      { x: 80, y: 0 },
      { x: 80, y: 50 },
      { x: 0, y: 50 },
    ]);
  });

  it('starts without board, corners or matches', () => {
    const project = createProject();
    expect(project.board).toBeNull();
    expect(project.matches).toEqual([]);
    expect(project.layers.every((l) => Object.keys(l.corners).length === 0)).toBe(true);
  });
});
