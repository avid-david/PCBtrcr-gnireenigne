import { Container, Graphics, Text } from 'pixi.js';
import type { Rect } from '../../core/geometry/rect';
import { DIMMED_ALPHA, type FeatureDrawable } from '../featureScene';
import { textTransform, type TextItem } from '../textItems';
import type { Scene } from '../scene';
import type { ToolOverlay } from '../../tools/tool';
import { drawFeature, drawGhostFeature, type Paint } from './featureDrawing';

const SHOW_ALL = { copper: true, print: true };
const GHOST = { color: 0xffffff, alpha: 0.45, padColors: [], show: SHOW_ALL };
/** Glyphs are rendered at this size and scaled to the text height in mm. */
const FONT_PX = 64;
const SNAP_RING_PX = 7;

/**
 * Copper features in board space. The geometry is rebuilt only when the scene's feature list
 * changes (after an edit or a layer switch); panning and zooming just move the container.
 */
export class FeatureLayer {
  readonly root = new Container();
  private readonly copper = new Graphics();
  private readonly labels = new Container();
  private readonly tool = new Graphics();
  private drawn: readonly FeatureDrawable[] | null = null;
  private written: readonly TextItem[] | null = null;
  private readonly texts = new Map<string, Text>();

  constructor() {
    this.root.addChild(this.copper, this.labels, this.tool);
  }

  draw(scene: Scene): void {
    if (scene.features !== this.drawn) {
      this.drawn = scene.features;
      drawCopper(this.copper.clear(), scene.features);
    }
    if (scene.texts !== this.written) {
      this.written = scene.texts;
      this.writeTexts(scene.texts);
    }
    const g = this.tool.clear();
    const pixel = 1 / scene.viewport.zoom;
    drawRubberBand(g, scene.toolOverlay.rubberBand);
    drawGhost(g, scene.toolOverlay.ghost);
    drawSnapRing(g, scene.toolOverlay.snapTarget, pixel);
    drawBox(g, scene.toolOverlay.box, pixel);
  }

  /** Updates the text objects to the items, reusing them by key so unchanged ones keep their glyphs. */
  private writeTexts(items: readonly TextItem[]): void {
    removeTexts(this.texts, new Set(items.map((i) => i.key)));
    for (const item of items) {
      const text = this.texts.get(item.key) ?? this.addText(item.key);
      placeText(text, item);
    }
  }

  private addText(key: string): Text {
    const text = new Text({
      text: '',
      style: { fontFamily: 'system-ui, sans-serif', fontSize: FONT_PX, lineHeight: FONT_PX },
    });
    this.texts.set(key, text);
    this.labels.addChild(text);
    return text;
  }

  destroy(): void {
    this.root.destroy({ children: true });
  }
}

/** Destroys the text objects whose keys are no longer listed. */
function removeTexts(texts: Map<string, Text>, keep: ReadonlySet<string>): void {
  [...texts.keys()]
    .filter((key) => !keep.has(key))
    .forEach((key) => {
      texts.get(key)?.destroy();
      texts.delete(key);
    });
}

// Changing a text's content or colour re-renders its glyphs, so it is only done when they differ.
const setContent = (text: Text, value: string) => {
  if (text.text !== value) {
    text.text = value;
  }
};

const setColor = (text: Text, color: number) => {
  if (text.style.fill !== color) {
    text.style.fill = color;
  }
};

/** Sets a text's content, colour and placement (mirrored text is flipped about its own box). */
function placeText(text: Text, item: TextItem): void {
  setContent(text, item.text);
  setColor(text, item.color);
  text.alpha = item.alpha;
  const t = textTransform(item, text.getLocalBounds().width, FONT_PX);
  text.scale.set(t.scaleX, t.scaleY);
  text.position.set(t.x, t.y);
}

/** All features, inactive-layer ones faint. Only called when the feature list changed. */
function drawCopper(g: Graphics, features: readonly FeatureDrawable[]): void {
  for (const d of features) {
    const paint: Paint = {
      color: d.color,
      alpha: d.dimmed ? DIMMED_ALPHA : 1,
      points: d.points,
      padColors: d.padColors,
      show: d.show,
    };
    drawFeature(g, d.feature, paint);
  }
}

/** The trace being drawn, as a ghost trace through its points and the cursor. */
function drawRubberBand(g: Graphics, band: ToolOverlay['rubberBand']): void {
  if (band !== null) {
    const trace = {
      kind: 'trace',
      id: '',
      layerId: '',
      widthMm: band.widthMm,
      vertices: [],
    } as const;
    drawFeature(g, trace, { ...GHOST, points: band.points });
  }
}

/** A feature about to be placed. */
function drawGhost(g: Graphics, ghost: ToolOverlay['ghost']): void {
  if (ghost !== null) {
    drawGhostFeature(g, ghost, { ...GHOST, points: [] });
  }
}

/** A ring of constant screen size around the anchor the cursor would snap to. */
function drawSnapRing(g: Graphics, at: ToolOverlay['snapTarget'], pixel: number): void {
  if (at !== null) {
    g.circle(at.x, at.y, SNAP_RING_PX * pixel).stroke({ width: 2 * pixel, color: 0xffffff });
  }
}

function drawBox(g: Graphics, box: Rect | null, pixel: number): void {
  if (box !== null) {
    g.rect(box.minX, box.minY, box.maxX - box.minX, box.maxY - box.minY)
      .fill({ color: 0x58a6ff, alpha: 0.12 })
      .stroke({ width: pixel, color: 0x58a6ff });
  }
}
