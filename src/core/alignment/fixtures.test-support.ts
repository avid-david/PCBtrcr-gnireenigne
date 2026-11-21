import {
  addMatch,
  placePoint,
  setBoardSize,
  setLayerImage,
  type Command,
} from '../commands/command';
import { apply, invert, type Mat3 } from '../geometry/mat3';
import type { Vec2 } from '../geometry/vec2';
import {
  CORNERS,
  cornerPosition,
  createProject,
  type Board,
  type LayerId,
  type Project,
  type SourceImage,
} from '../model/project';

// Builders for alignment tests: a project with photos whose "true" pixel ↔ board mapping is
// known, so clicked points can be generated from board positions.

export const photo = (id: string, widthPx = 4000, heightPx = 3000): SourceImage => ({
  id,
  fileName: `${id}.jpg`,
  mimeType: 'image/jpeg',
  widthPx,
  heightPx,
});

export const board: Board = { widthMm: 80, heightMm: 50 };

/** Board mm → top photo pixels: 40 px/mm, offset, with a little perspective. */
export const TOP_TRUTH: Mat3 = [40, 1.5, 300, -0.8, 41, 250, 0.0004, 0.0002, 1];
/** Board mm → bottom photo pixels: mirrored (seen from below), different framing. */
export const BOTTOM_TRUTH: Mat3 = [-38, 0.6, 3600, 1.2, 39, 320, -0.0003, 0.0003, 1];

export const run = (project: Project, commands: readonly Command[]): Project =>
  commands.reduce((p, c) => c.execute(p), project);

/** Pixel where a board position appears on a photo with the given board → pixel mapping. */
export const pixelOf = (truth: Mat3, boardMm: Vec2): Vec2 => apply(truth, boardMm);

/** Commands that click the 4 board corners on a layer, optionally offset by `noisePx`. */
export const cornerClicks = (
  layerId: LayerId,
  truth: Mat3,
  noisePx: Vec2 = { x: 0, y: 0 },
): Command[] =>
  CORNERS.map((corner) => {
    const p = pixelOf(truth, cornerPosition(board, corner));
    return placePoint(
      { kind: 'corner', layerId, corner },
      { x: p.x + noisePx.x, y: p.y + noisePx.y },
    );
  });

/** Command matching one board feature between the top and bottom photos. */
export const matchAt = (id: string, boardMm: Vec2, bottomNoise: Vec2 = { x: 0, y: 0 }): Command => {
  const bottom = pixelOf(BOTTOM_TRUTH, boardMm);
  return addMatch({
    id,
    points: {
      top: pixelOf(TOP_TRUTH, boardMm),
      bottom: { x: bottom.x + bottomNoise.x, y: bottom.y + bottomNoise.y },
    },
  });
};

/** Feature positions spread over the board (vias, holes…), in mm. */
export const FEATURES: readonly Vec2[] = [
  { x: 10, y: 8 },
  { x: 70, y: 9 },
  { x: 68, y: 42 },
  { x: 12, y: 44 },
  { x: 40, y: 25 },
  { x: 25, y: 30 },
];

/** Both photos imported, board size set and the top corners clicked exactly. */
export function alignedTopProject(): Project {
  return run(createProject(), [
    setLayerImage('top', photo('t')),
    setLayerImage('bottom', photo('b')),
    setBoardSize(board),
    ...cornerClicks('top', TOP_TRUTH),
  ]);
}

/** Inverse of a truth mapping (pixels → board), for comparing against fitted transforms. */
export const pixelsToBoard = (truth: Mat3): Mat3 => {
  const inverse = invert(truth);
  return inverse.ok ? inverse.value : truth;
};
