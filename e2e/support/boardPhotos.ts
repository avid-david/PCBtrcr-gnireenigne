import { makePng, type Rgb } from './png';

// Synthetic photos of one 80 × 50 mm board for the alignment e2e test: a perspective top view
// and a mirrored, differently tilted bottom view, with coloured blobs at the 4 corners and at
// 6 vias so the test can find and click them on screen.

export const BOARD = { widthMm: 80, heightMm: 50 } as const;

type Mat = readonly [number, number, number, number, number, number, number, number, number];
interface Point {
  readonly x: number;
  readonly y: number;
}

const apply = (m: Mat, p: Point): Point => {
  const w = m[6] * p.x + m[7] * p.y + m[8];
  return { x: (m[0] * p.x + m[1] * p.y + m[2]) / w, y: (m[3] * p.x + m[4] * p.y + m[5]) / w };
};

function invert(m: Mat): Mat {
  const [a, b, c, d, e, f, g, h, i] = m;
  const det = a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g);
  return [
    (e * i - f * h) / det,
    (c * h - b * i) / det,
    (b * f - c * e) / det,
    (f * g - d * i) / det,
    (a * i - c * g) / det,
    (c * d - a * f) / det,
    (d * h - e * g) / det,
    (b * g - a * h) / det,
    (a * e - b * d) / det,
  ];
}

/** Board mm → photo pixels. */
const TOP_VIEW: Mat = [18, 0.5, 120, -0.3, 18.5, 90, 0.00008, 0.00005, 1];
const BOTTOM_VIEW: Mat = [-17.5, 0.4, 1580, 0.5, 18, 100, -0.00006, 0.00007, 1];

export const PHOTO_SIZE = { width: 1700, height: 1100 } as const;

const BLOB_RADIUS_MM = 1.3;
const BOARD_GREEN: Rgb = [20, 90, 40];
const BACKGROUND: Rgb = [128, 128, 128];

export const CORNER_COLORS: Readonly<Record<'tl' | 'tr' | 'br' | 'bl', Rgb>> = {
  tl: [255, 0, 255],
  tr: [0, 255, 255],
  br: [255, 255, 0],
  bl: [255, 128, 0],
};

export const VIAS: readonly { readonly at: Point; readonly color: Rgb }[] = [
  { at: { x: 10, y: 8 }, color: [255, 0, 0] },
  { at: { x: 70, y: 9 }, color: [0, 0, 255] },
  { at: { x: 68, y: 42 }, color: [128, 0, 255] },
  { at: { x: 12, y: 44 }, color: [0, 128, 255] },
  { at: { x: 40, y: 25 }, color: [255, 0, 128] },
  { at: { x: 25, y: 30 }, color: [150, 75, 0] },
];

const corners: readonly { readonly at: Point; readonly color: Rgb }[] = [
  { at: { x: 0, y: 0 }, color: CORNER_COLORS.tl },
  { at: { x: BOARD.widthMm, y: 0 }, color: CORNER_COLORS.tr },
  { at: { x: BOARD.widthMm, y: BOARD.heightMm }, color: CORNER_COLORS.br },
  { at: { x: 0, y: BOARD.heightMm }, color: CORNER_COLORS.bl },
];

function colorAtBoard(p: Point): Rgb {
  const blob = [...corners, ...VIAS].find(
    (b) => Math.hypot(b.at.x - p.x, b.at.y - p.y) <= BLOB_RADIUS_MM,
  );
  if (blob !== undefined) {
    return blob.color;
  }
  const onBoard = p.x >= 0 && p.y >= 0 && p.x <= BOARD.widthMm && p.y <= BOARD.heightMm;
  return onBoard ? BOARD_GREEN : BACKGROUND;
}

const render = (view: Mat): Buffer => {
  const toBoard = invert(view);
  return makePng(PHOTO_SIZE.width, PHOTO_SIZE.height, (x, y) =>
    colorAtBoard(apply(toBoard, { x: x + 0.5, y: y + 0.5 })),
  );
};

export const topPhoto = (): Buffer => render(TOP_VIEW);
export const bottomPhoto = (): Buffer => render(BOTTOM_VIEW);
