import type { Graphics } from 'pixi.js';
import type { Vec2 } from '../../core/geometry/vec2';
import type { Feature, FeatureKindName } from '../../core/model/features';

/** Colour of drilled holes (the board background shows through). */
const DRILL = 0x0b0c0e;

export interface Paint {
  readonly color: number;
  readonly alpha: number;
}

type Drawer<F extends Feature> = (
  g: Graphics,
  f: F,
  paint: Paint & { points: readonly Vec2[] },
) => void;

const drill = (g: Graphics, hole: { at: Vec2; diameterMm: number }, alpha: number) => {
  if (hole.diameterMm > 0) {
    g.circle(hole.at.x, hole.at.y, hole.diameterMm / 2).fill({ color: DRILL, alpha });
  }
};

const padShape = (g: Graphics, f: Extract<Feature, { kind: 'pad' }>) => {
  const x = f.at.x - f.widthMm / 2;
  const y = f.at.y - f.heightMm / 2;
  const shapes = {
    rect: () => g.rect(x, y, f.widthMm, f.heightMm),
    round: () => g.ellipse(f.at.x, f.at.y, f.widthMm / 2, f.heightMm / 2),
    oval: () => g.roundRect(x, y, f.widthMm, f.heightMm, Math.min(f.widthMm, f.heightMm) / 2),
  };
  return shapes[f.shape]();
};

/** How each kind is drawn, in board mm (the world container scales to the screen). */
const drawers: { readonly [K in FeatureKindName]: Drawer<Extract<Feature, { kind: K }>> } = {
  trace: (g, f, { points, color, alpha }) => {
    const [first, ...rest] = points;
    if (first === undefined) {
      return;
    }
    g.moveTo(first.x, first.y);
    rest.forEach((p) => g.lineTo(p.x, p.y));
    g.stroke({ width: f.widthMm, color, alpha, cap: 'round', join: 'round' });
  },
  via: (g, f, { color, alpha }) => {
    g.circle(f.at.x, f.at.y, f.padMm / 2).fill({ color, alpha });
    drill(g, { at: f.at, diameterMm: f.drillMm }, alpha);
  },
  hole: (g, f, { color, alpha }) => {
    if (f.plated) {
      g.circle(f.at.x, f.at.y, f.diameterMm / 2 + 0.15).fill({ color, alpha });
    } else {
      g.circle(f.at.x, f.at.y, f.diameterMm / 2).stroke({ width: 0.08, color, alpha });
    }
    drill(g, f, alpha);
  },
  pad: (g, f, { color, alpha }) => {
    padShape(g, f).fill({ color, alpha });
    drill(g, { at: f.at, diameterMm: f.layerId === null ? f.drillMm : 0 }, alpha);
  },
  point: (g, f, { color, alpha }) => {
    g.circle(f.at.x, f.at.y, f.diameterMm / 2).fill({ color, alpha });
    g.circle(f.at.x, f.at.y, f.diameterMm / 5).fill({ color: DRILL, alpha });
  },
};

/** Draws one feature into `g`. */
export function drawFeature(
  g: Graphics,
  f: Feature,
  paint: Paint & { points: readonly Vec2[] },
): void {
  (drawers[f.kind] as Drawer<Feature>)(g, f, paint);
}
