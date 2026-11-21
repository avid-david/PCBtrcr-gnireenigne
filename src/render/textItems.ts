import { boundsOfPoints, rectCenter } from '../core/geometry/rect';
import type { Vec2 } from '../core/geometry/vec2';
import { toBoard } from '../core/model/component';
import type { Component, Feature } from '../core/model/features';
import { textBox } from '../core/model/text';
import type { LayerId } from '../core/model/project';

/** Colour of silkscreen print. */
export const SILK_COLOR = 0xf2f2f2;
/** Colour of notes, which are not part of the board. */
export const NOTE_COLOR = 0xffd866;

/** A text to draw: its top-left corner and height in board mm. */
export interface TextItem {
  readonly key: string;
  readonly text: string;
  readonly at: Vec2;
  readonly heightMm: number;
  readonly color: number;
  readonly alpha: number;
  /** Printed on the bottom side: seen from the top it reads mirrored (about its own centre). */
  readonly mirrored: boolean;
}

const DESIGNATOR = { minMm: 0.6, maxMm: 1.5, share: 0.4 };

/** A component's designator, centred on its body and sized to fit it. */
function designator(c: Component, alpha: number): TextItem[] {
  const body = boundsOfPoints(c.outline.flat()) ?? { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  const size = Math.min(body.maxX - body.minX, body.maxY - body.minY) * DESIGNATOR.share;
  const heightMm = Math.min(DESIGNATOR.maxMm, Math.max(DESIGNATOR.minMm, size));
  const centre = toBoard(c, rectCenter(body));
  const box = textBox({ x: 0, y: 0 }, c.designator, heightMm);
  const at = { x: centre.x - box.maxX / 2, y: centre.y - box.maxY / 2 };
  const printed = { id: c.id, text: c.designator, at, heightMm };
  return c.designator === ''
    ? []
    : [item(printed, { color: SILK_COLOR, alpha, mirrored: c.flipped })];
}

type Texts = (f: Feature, alpha: number, bottom: boolean) => TextItem[];

type Printed = Pick<Extract<Feature, { kind: 'text' }>, 'id' | 'text' | 'at' | 'heightMm'>;

const item = (
  f: Printed,
  paint: { color: number; alpha: number; mirrored: boolean },
): TextItem => ({
  key: f.id,
  text: f.text,
  at: f.at,
  heightMm: f.heightMm,
  ...paint,
});

const texts: Partial<Readonly<Record<Feature['kind'], Texts>>> = {
  text: (f, alpha) =>
    f.kind === 'text' ? [item(f, { color: NOTE_COLOR, alpha, mirrored: false })] : [],
  silkText: (f, alpha, bottom) =>
    f.kind === 'silkText' ? [item(f, { color: SILK_COLOR, alpha, mirrored: bottom })] : [],
  component: (f, alpha) => (f.kind === 'component' ? designator(f, alpha) : []),
};

/**
 * Texts a feature shows. Bottom-side silkscreen is mirrored, as it looks from the top; notes
 * never are.
 */
export function textItemsOf(
  f: Feature,
  options: { readonly alpha: number; readonly bottomLayers: ReadonlySet<LayerId> },
): TextItem[] {
  const bottom = 'layerId' in f && f.layerId !== null && options.bottomLayers.has(f.layerId);
  return texts[f.kind]?.(f, options.alpha, bottom) ?? [];
}
