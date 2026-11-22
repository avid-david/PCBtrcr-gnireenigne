import { Container, Graphics, Text } from 'pixi.js';
import type { Vec2 } from '../../core/geometry/vec2';
import { boardToScreen, type Viewport } from '../../core/geometry/viewport';
import { HANDLE_DRAW_PX } from '../../tools/resizeHandle';
import type { MarkerStatus, SceneMarker } from '../alignOverlay';
import type { Scene } from '../scene';

/** Marker colours; red/green are paired with different labels so colour is not the only cue. */
const MARKER_COLORS: Readonly<Record<MarkerStatus, number>> = {
  fitted: 0x3fb950,
  outlier: 0xf85149,
  unused: 0xd29922,
  pending: 0x58a6ff,
};
const OUTLINE_COLOR = 0xf0f6fc;
const SELECTION_COLOR = 0xffffff;
const MARKER_RADIUS = 7;
const LABEL_STYLE = { fontFamily: 'system-ui, sans-serif', fontSize: 12, fill: 0xffffff } as const;

/**
 * Board outline and alignment markers, drawn in screen space so they keep their size at any
 * zoom. Redrawn completely each frame: there are only a handful of points.
 */
export class OverlayLayer {
  readonly root = new Container();
  private readonly graphics = new Graphics();
  private readonly labels: Text[] = [];

  constructor() {
    this.root.addChild(this.graphics);
  }

  draw(scene: Scene): void {
    this.graphics.clear();
    this.drawOutline(scene.outline, scene.viewport);
    this.drawSelection(scene.selection, scene.viewport);
    this.drawHandle(scene.handle, scene.viewport);
    scene.markers.forEach((marker) => {
      this.drawMarker(marker, scene.viewport);
    });
    this.updateLabels(scene.markers, scene.viewport);
  }

  /** A dashed-looking double frame around each selected feature, constant on screen. */
  private drawSelection(boxes: Scene['selection'], viewport: Viewport): void {
    for (const box of boxes) {
      const a = boardToScreen(viewport, { x: box.minX, y: box.minY });
      const b = boardToScreen(viewport, { x: box.maxX, y: box.maxY });
      this.graphics
        .rect(a.x - 3, a.y - 3, b.x - a.x + 6, b.y - a.y + 6)
        .stroke({ width: 3, color: 0x000000, alpha: 0.6 })
        .rect(a.x - 3, a.y - 3, b.x - a.x + 6, b.y - a.y + 6)
        .stroke({ width: 1.5, color: SELECTION_COLOR });
    }
  }

  /** The resize handle: a white dot with a dark ring, so it shows on any photo. */
  private drawHandle(handle: Scene['handle'], viewport: Viewport): void {
    if (handle === null) {
      return;
    }
    const { x, y } = boardToScreen(viewport, handle);
    this.graphics
      .circle(x, y, HANDLE_DRAW_PX)
      .fill({ color: SELECTION_COLOR })
      .stroke({ width: 1.5, color: 0x000000, alpha: 0.8 });
  }

  private drawOutline(outline: Scene['outline'], viewport: Viewport): void {
    if (outline === null) {
      return;
    }
    const points = outline.flatMap((p) => {
      const s = boardToScreen(viewport, p);
      return [s.x, s.y];
    });
    this.graphics.poly(points, true).stroke({ width: 1.5, color: OUTLINE_COLOR, alpha: 0.8 });
  }

  private drawMarker(marker: SceneMarker, viewport: Viewport): void {
    const { x, y } = boardToScreen(viewport, marker.at);
    const color = MARKER_COLORS[marker.status];
    const r = MARKER_RADIUS;
    this.graphics
      .circle(x, y, r)
      .stroke({ width: 2, color })
      .moveTo(x - r - 4, y)
      .lineTo(x + r + 4, y)
      .moveTo(x, y - r - 4)
      .lineTo(x, y + r + 4)
      .stroke({ width: 1, color });
  }

  private updateLabels(markers: readonly SceneMarker[], viewport: Viewport): void {
    while (this.labels.length < markers.length) {
      const label = new Text({ text: '', style: LABEL_STYLE });
      this.labels.push(label);
      this.root.addChild(label);
    }
    this.labels.forEach((label, i) => {
      const marker = markers[i];
      label.visible = marker !== undefined;
      if (marker !== undefined) {
        const at: Vec2 = boardToScreen(viewport, marker.at);
        label.text = marker.label;
        label.position.set(at.x + MARKER_RADIUS + 3, at.y - MARKER_RADIUS - 14);
      }
    });
  }

  destroy(): void {
    this.root.destroy({ children: true });
  }
}
