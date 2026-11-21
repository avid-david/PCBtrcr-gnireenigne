import { Container, Graphics } from 'pixi.js';
import type { Rect } from '../../core/geometry/rect';
import type { FeatureDrawable } from '../featureScene';
import type { Scene } from '../scene';
import type { ToolOverlay } from '../../tools/tool';
import { drawFeature } from './featureDrawing';

/** Opacity of features that are only on an inactive layer. */
const DIMMED_ALPHA = 0.3;
const GHOST = { color: 0xffffff, alpha: 0.45 };
const SNAP_RING_PX = 7;

/**
 * Copper features in board space. The geometry is rebuilt only when the scene's feature list
 * changes (after an edit or a layer switch); panning and zooming just move the container.
 */
export class FeatureLayer {
  readonly root = new Container();
  private readonly copper = new Graphics();
  private readonly tool = new Graphics();
  private drawn: readonly FeatureDrawable[] | null = null;

  constructor() {
    this.root.addChild(this.copper, this.tool);
  }

  draw(scene: Scene): void {
    if (scene.features !== this.drawn) {
      this.drawn = scene.features;
      drawCopper(this.copper.clear(), scene.features);
    }
    const g = this.tool.clear();
    const pixel = 1 / scene.viewport.zoom;
    drawRubberBand(g, scene.toolOverlay.rubberBand);
    drawGhost(g, scene.toolOverlay.ghost);
    drawSnapRing(g, scene.toolOverlay.snapTarget, pixel);
    drawBox(g, scene.toolOverlay.box, pixel);
  }

  destroy(): void {
    this.root.destroy({ children: true });
  }
}

/** All copper, inactive-layer features faint. Only called when the feature list changed. */
function drawCopper(g: Graphics, features: readonly FeatureDrawable[]): void {
  for (const d of features) {
    drawFeature(g, d.feature, {
      color: d.color,
      alpha: d.dimmed ? DIMMED_ALPHA : 1,
      points: d.points,
    });
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

function drawGhost(g: Graphics, ghost: ToolOverlay['ghost']): void {
  if (ghost !== null) {
    drawFeature(g, ghost, { ...GHOST, points: [] });
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
