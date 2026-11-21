import { Application, Container, Matrix, Sprite, Texture } from 'pixi.js';
import type { Mat3 } from '../../core/geometry/mat3';
import type { ScreenSize } from '../../core/geometry/viewport';
import type { LoadedImage } from '../../core/model/image';
import type { ImageId } from '../../core/model/project';
import type { ImageLookup, Renderer } from '../renderer';
import type { Scene } from '../scene';

const BACKGROUND = '#15171a';

/** Our row-major Mat3 → PixiJS matrix (a, b, c, d, tx, ty). Only the affine part is used. */
const toPixiMatrix = (m: Mat3): Matrix => new Matrix(m[0], m[3], m[1], m[4], m[2], m[5]);

function buildImageContainer(image: LoadedImage<ImageBitmap>): Container {
  const container = new Container();
  for (const tile of image.tiles) {
    const sprite = new Sprite(Texture.from(tile.pixels));
    sprite.position.set(tile.rect.x, tile.rect.y);
    container.addChild(sprite);
  }
  return container;
}

class PixiRenderer implements Renderer {
  private readonly world = new Container();
  private readonly imageContainers = new Map<ImageId, Container>();
  private readonly app: Application;
  private readonly images: ImageLookup<ImageBitmap>;

  constructor(app: Application, images: ImageLookup<ImageBitmap>) {
    this.app = app;
    this.images = images;
    app.stage.addChild(this.world);
  }

  render(scene: Scene): void {
    this.world.removeChildren();
    this.world.scale.set(scene.viewport.zoom);
    this.world.position.set(scene.viewport.offset.x, scene.viewport.offset.y);
    for (const layer of scene.layers) {
      const container = this.containerFor(layer.imageId);
      if (container === undefined) {
        continue;
      }
      container.setFromMatrix(toPixiMatrix(layer.imageToBoard));
      container.alpha = layer.opacity;
      this.world.addChild(container);
    }
    this.app.render();
  }

  resize(size: ScreenSize): void {
    this.app.renderer.resize(Math.max(1, size.width), Math.max(1, size.height));
  }

  forgetImage(id: ImageId): void {
    this.imageContainers.get(id)?.destroy({ children: true, texture: true, textureSource: true });
    this.imageContainers.delete(id);
  }

  destroy(): void {
    [...this.imageContainers.keys()].forEach((id) => {
      this.forgetImage(id);
    });
    this.app.destroy(true, { children: true });
  }

  private containerFor(id: ImageId): Container | undefined {
    const cached = this.imageContainers.get(id);
    if (cached !== undefined) {
      return cached;
    }
    const image = this.images(id);
    if (image === undefined) {
      return undefined;
    }
    const container = buildImageContainer(image);
    this.imageContainers.set(id, container);
    return container;
  }
}

/** Creates a WebGL renderer and attaches its canvas to `host`. */
export async function createPixiRenderer(
  host: HTMLElement,
  images: ImageLookup<ImageBitmap>,
): Promise<Renderer> {
  const app = new Application();
  await app.init({
    preference: 'webgl',
    background: BACKGROUND,
    antialias: false,
    autoStart: false,
    resolution: window.devicePixelRatio,
    autoDensity: true,
    width: Math.max(1, host.clientWidth),
    height: Math.max(1, host.clientHeight),
    // Lets e2e tests read rendered pixels; the cost is negligible for an on-demand renderer.
    preserveDrawingBuffer: true,
  });
  app.ticker.stop();
  app.canvas.setAttribute('aria-hidden', 'true');
  host.appendChild(app.canvas);
  return new PixiRenderer(app, images);
}
