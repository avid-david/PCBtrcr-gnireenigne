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
      this.copper.clear();
      for (const d of scene.features) {
        drawFeature(this.copper, d.feature, {
          color: d.color,
          alpha: d.dimmed ? DIMMED_ALPHA : 1,
          points: d.points,
        });
      }
    }
    this.drawTool(scene.toolOverlay, scene.viewport.zoom);
  }

  /** Rubber band, ghost, snap ring and selection box: small, so redrawn every frame. */
  private drawTool(overlay: ToolOverlay, zoom: number): void {
    const g = this.tool.clear();
    const pixel = 1 / zoom;
    if (overlay.rubberBand !== null) {
      drawFeature(
        g,
        { kind: 'trace', id: '', layerId: '', widthMm: overlay.rubberBand.widthMm, vertices: [] },
        {
          ...GHOST,
          points: overlay.rubberBand.points,
        },
      );
    }
    if (overlay.ghost !== null) {
      drawFeature(g, overlay.ghost, { ...GHOST, points: [] });
    }
    if (overlay.snapTarget !== null) {
      g.circle(overlay.snapTarget.x, overlay.snapTarget.y, SNAP_RING_PX * pixel).stroke({
        width: 2 * pixel,
        color: 0xffffff,
      });
    }
    drawBox(g, overlay.box, pixel);
  }

  destroy(): void {
    this.root.destroy({ children: true });
  }
}

function drawBox(g: Graphics, box: Rect | null, pixel: number): void {
  if (box !== null) {
    g.rect(box.minX, box.minY, box.maxX - box.minX, box.maxY - box.minY)
      .fill({ color: 0x58a6ff, alpha: 0.12 })
      .stroke({ width: pixel, color: 0x58a6ff });
  }
}
