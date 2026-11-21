import { tileGrid, type PixelRect } from '../core/geometry/tiling';
import {
  checkImageSize,
  checkImageType,
  type ImageLoadError,
  type ImageTile,
  type LoadedImage,
} from '../core/model/image';
import { err, ok, type Result } from '../core/result';

/** Minimal file description, so the loader does not depend on the DOM `File` type. */
export interface ImageFile {
  readonly name: string;
  readonly type: string;
}

export interface Decoded<P> {
  readonly widthPx: number;
  readonly heightPx: number;
  readonly pixels: P;
}

/** Platform operations the loader needs; the browser versions live in browserImage.ts. */
export interface ImageCodec<F extends ImageFile, P> {
  decode(file: F): Promise<Decoded<P>>;
  crop(pixels: P, rect: PixelRect): Promise<P>;
  release(pixels: P): void;
  newId(): string;
}

export type ImageLoader<F extends ImageFile, P> = (
  file: F,
) => Promise<Result<LoadedImage<P>, ImageLoadError>>;

const reasonOf = (cause: unknown): string =>
  cause instanceof Error ? cause.message : String(cause);

async function decodeSafely<F extends ImageFile, P>(
  codec: ImageCodec<F, P>,
  file: F,
): Promise<Result<Decoded<P>, ImageLoadError>> {
  try {
    return ok(await codec.decode(file));
  } catch (cause) {
    return err({ kind: 'decode-failed', reason: reasonOf(cause) });
  }
}

async function cutTiles<P>(
  codec: Pick<ImageCodec<ImageFile, P>, 'crop' | 'release'>,
  decoded: Decoded<P>,
): Promise<Result<ImageTile<P>[], ImageLoadError>> {
  const rects = tileGrid(decoded.widthPx, decoded.heightPx);
  // allSettled, not all: when one crop fails the others still finish, and their tiles must be freed.
  const settled = await Promise.allSettled(
    rects.map(async (rect) => ({ rect, pixels: await codec.crop(decoded.pixels, rect) })),
  );
  codec.release(decoded.pixels);
  const tiles = settled.flatMap((s) => (s.status === 'fulfilled' ? [s.value] : []));
  const failure = settled.find((s): s is PromiseRejectedResult => s.status === 'rejected');
  if (failure === undefined) {
    return ok(tiles);
  }
  tiles.forEach((tile) => {
    codec.release(tile.pixels);
  });
  return err({ kind: 'decode-failed', reason: reasonOf(failure.reason) });
}

/** Builds a loader that validates, decodes and tiles a photo; failures come back as `Result`. */
export function createImageLoader<F extends ImageFile, P>(
  codec: ImageCodec<F, P>,
): ImageLoader<F, P> {
  return async (file) => {
    const type = checkImageType(file.type);
    if (!type.ok) {
      return type;
    }
    const decoded = await decodeSafely(codec, file);
    if (!decoded.ok) {
      return decoded;
    }
    const { widthPx, heightPx } = decoded.value;
    const size = checkImageSize(widthPx, heightPx);
    if (!size.ok) {
      codec.release(decoded.value.pixels);
      return size;
    }
    const image = {
      id: codec.newId(),
      fileName: file.name,
      mimeType: file.type,
      widthPx,
      heightPx,
    };
    const tiles = await cutTiles(codec, decoded.value);
    return tiles.ok ? ok({ image, tiles: tiles.value }) : tiles;
  };
}
