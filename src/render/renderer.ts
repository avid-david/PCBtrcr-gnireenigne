import type { ScreenSize } from '../core/geometry/viewport';
import type { LoadedImage } from '../core/model/image';
import type { ImageId } from '../core/model/project';
import type { Scene } from './scene';

/**
 * Draws scenes. The rest of the app depends on this interface only, so the PixiJS
 * implementation can be replaced (docs/adr/0003). Renderers read state, never mutate it.
 */
export interface Renderer {
  /** Draws one frame. Called only when something changed; there is no continuous loop. */
  render(scene: Scene): void;
  /** Resizes the drawing surface to the given CSS-pixel size. */
  resize(size: ScreenSize): void;
  /** Frees GPU resources held for an image that is no longer used. */
  forgetImage(id: ImageId): void;
  destroy(): void;
}

/** Looks up decoded pixels for an image id. `P` is the platform's pixel handle. */
export type ImageLookup<P> = (id: ImageId) => LoadedImage<P> | undefined;
