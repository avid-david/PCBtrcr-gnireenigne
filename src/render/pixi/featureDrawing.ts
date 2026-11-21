import type { Graphics } from 'pixi.js';
import type { Vec2 } from '../../core/geometry/vec2';
import { padPolygon, toBoard } from '../../core/model/component';
import { textBox } from '../../core/model/text';
import type { Component, Feature, FeatureKindName } from '../../core/model/features';
import { SILK_COLOR } from '../textItems';

/** Colour of drilled holes (the board background shows through). */
const DRILL = 0x0b0c0e;

/** Silkscreen line width of component outlines (mm). */
const OUTLINE_MM = 0.12;
/** Opacity of a plane's fill relative to its outline, so what lies on it stays readable. */
const PLANE_FILL = 0.35;
/** Opacity of a pad that is not on the highlighted net (as for dimmed features). */
const DIMMED_PAD = 0.3;

export interface Paint {
  readonly color: number;
  readonly alpha: number;
  /** Trace vertex positions (bound ones resolved). */
  readonly points: readonly Vec2[];
  /** Net colour of each component pad. */
  readonly padColors: readonly number[];
  /** Per component pad: drawn faint (a net is highlighted that it is not on). */
  readonly padDimmed: readonly boolean[];
  readonly show: { readonly copper: boolean; readonly print: boolean };
}

type Drawer<F extends Feature> = (g: Graphics, f: F, paint: Paint) => void;

const polyline = (g: Graphics, points: readonly Vec2[]) => {
  const [first, ...rest] = points;
  if (first !== undefined) {
    g.moveTo(first.x, first.y);
    rest.forEach((p) => g.lineTo(p.x, p.y));
  }
  return g;
};

function componentPads(g: Graphics, c: Component, paint: Paint) {
  c.pads.forEach((pad, i) => {
    const alpha = paint.padDimmed[i] === true ? paint.alpha * DIMMED_PAD : paint.alpha;
    g.poly(padPolygon(c, pad)).fill({ color: paint.padColors[i] ?? paint.color, alpha });
    drill(g, { at: toBoard(c, pad.at), diameterMm: pad.drillMm }, alpha);
  });
}

function componentOutline(g: Graphics, c: Component, alpha: number) {
  for (const line of c.outline) {
    polyline(
      g,
      line.map((p) => toBoard(c, p)),
    ).stroke({ width: OUTLINE_MM, color: SILK_COLOR, alpha });
  }
}

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
    if (points.length > 0) {
      polyline(g, points).stroke({ width: f.widthMm, color, alpha, cap: 'round', join: 'round' });
    }
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
  component: (g, f, paint) => {
    if (paint.show.copper) {
      componentPads(g, f, paint);
    }
    if (paint.show.print) {
      componentOutline(g, f, paint.alpha);
    }
  },
  plane: (g, f, { color, alpha }) => {
    g.poly([...f.outline]).fill({ color, alpha: alpha * PLANE_FILL });
    g.poly([...f.outline]).stroke({ width: OUTLINE_MM, color, alpha });
  },
  silkLine: (g, f, { alpha }) => {
    polyline(g, f.points).stroke({
      width: f.widthMm,
      color: SILK_COLOR,
      alpha,
      cap: 'round',
      join: 'round',
    });
  },
  // Texts are drawn as text objects by the feature layer.
  text: () => undefined,
  silkText: () => undefined,
};

/** A text being placed shows the box it will fill (its glyphs are drawn only once placed). */
const textGhost = (g: Graphics, f: { at: Vec2; text: string; heightMm: number }, paint: Paint) => {
  const box = textBox(f.at, f.text, f.heightMm);
  g.rect(box.minX, box.minY, box.maxX - box.minX, box.maxY - box.minY).fill({
    color: paint.color,
    alpha: paint.alpha,
  });
};

const ghostDrawers: Partial<{
  readonly [K in FeatureKindName]: Drawer<Extract<Feature, { kind: K }>>;
}> = {
  text: textGhost,
  silkText: textGhost,
};

/** Draws a feature about to be placed (as itself, or as the box of a text). */
export function drawGhostFeature(g: Graphics, f: Feature, paint: Paint): void {
  ((ghostDrawers[f.kind] as Drawer<Feature> | undefined) ?? drawFeature)(g, f, paint);
}

/** Draws one feature into `g`. */
export function drawFeature(g: Graphics, f: Feature, paint: Paint): void {
  (drawers[f.kind] as Drawer<Feature>)(g, f, paint);
}
