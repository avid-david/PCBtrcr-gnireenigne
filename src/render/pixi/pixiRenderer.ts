import { Application, Container, PerspectiveMesh, Texture } from 'pixi.js';
import type { Mat3 } from '../../core/geometry/mat3';
import type { PixelRect } from '../../core/geometry/tiling';
import type { ScreenSize } from '../../core/geometry/viewport';
import type { LoadedImage } from '../../core/model/image';
import type { ImageId } from '../../core/model/project';
import type { ImageLookup, Renderer } from '../renderer';
import type { Scene } from '../scene';
import { MESH_VERTICES, tileCorners } from '../tileQuads';
import { OverlayLayer } from './overlayLayer';

const BACKGROUND = '#15171a';

/** A photo as one perspective mesh per tile; the warp is done on the GPU (docs/adr/0004). */
interface PhotoNode {
  readonly container: Container;
  readonly tiles: readonly { readonly mesh: PerspectiveMesh; readonly rect: PixelRect }[];
}

function buildPhoto(image: LoadedImage<ImageBitmap>): PhotoNode {
  const container = new Container();
  const tiles = image.tiles.map((tile) => {
    const mesh = new PerspectiveMesh({
      texture: Texture.from(tile.pixels),
      verticesX: MESH_VERTICES,
      verticesY: MESH_VERTICES,
    });
    container.addChild(mesh);
    return { mesh, rect: tile.rect };
  });
  return { container, tiles };
}

/** Places every tile so its corners land where the image → board transform puts them. */
function placePhoto(photo: PhotoNode, imageToBoard: Mat3): void {
  for (const { mesh, rect } of photo.tiles) {
    const [tl, tr, br, bl] = tileCorners(imageToBoard, rect);
    mesh.setCorners(tl.x, tl.y, tr.x, tr.y, br.x, br.y, bl.x, bl.y);
  }
}

class PixiRenderer implements Renderer {
  private readonly world = new Container();
  private readonly overlay = new OverlayLayer();
  private readonly photos = new Map<ImageId, PhotoNode>();
  private readonly app: Application;
  private readonly images: ImageLookup<ImageBitmap>;

  constructor(app: Application, images: ImageLookup<ImageBitmap>) {
    this.app = app;
    this.images = images;
    app.stage.addChild(this.world, this.overlay.root);
  }

  render(scene: Scene): void {
    this.world.removeChildren();
    this.world.scale.set(scene.viewport.zoom);
    this.world.position.set(scene.viewport.offset.x, scene.viewport.offset.y);
    for (const layer of scene.layers) {
      const photo = this.photoFor(layer.imageId);
      if (photo !== undefined) {
        placePhoto(photo, layer.imageToBoard);
        photo.container.alpha = layer.opacity;
        this.world.addChild(photo.container);
      }
    }
    this.overlay.draw(scene);
    this.app.render();
  }

  resize(size: ScreenSize): void {
    this.app.renderer.resize(Math.max(1, size.width), Math.max(1, size.height));
  }

  forgetImage(id: ImageId): void {
    this.photos.get(id)?.container.destroy({ children: true, texture: true, textureSource: true });
    this.photos.delete(id);
  }

  destroy(): void {
    [...this.photos.keys()].forEach((id) => {
      this.forgetImage(id);
    });
    this.overlay.destroy();
    this.app.destroy(true, { children: true });
  }

  private photoFor(id: ImageId): PhotoNode | undefined {
    const cached = this.photos.get(id);
    if (cached !== undefined) {
      return cached;
    }
    const image = this.images(id);
    if (image === undefined) {
      return undefined;
    }
    const photo = buildPhoto(image);
    this.photos.set(id, photo);
    return photo;
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
