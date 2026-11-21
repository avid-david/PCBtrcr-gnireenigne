import { err, ok, type Result } from '../result';
import type { PixelRect } from '../geometry/tiling';
import type { SourceImage } from './project';

/** File types accepted for import (SPEC F1). */
export const SUPPORTED_IMAGE_TYPES: readonly string[] = ['image/png', 'image/jpeg', 'image/webp'];

/** Largest accepted photo; a 24 MP photo already needs ~96 MB of GPU memory (docs/adr/0003). */
export const MAX_IMAGE_PIXELS = 100_000_000;

export type ImageLoadError =
  | { readonly kind: 'unsupported-type'; readonly mimeType: string }
  | { readonly kind: 'too-large'; readonly pixels: number }
  | { readonly kind: 'decode-failed'; readonly reason: string };

/** One tile of decoded pixels. `P` is the platform's pixel handle (e.g. ImageBitmap). */
export interface ImageTile<P> {
  readonly rect: PixelRect;
  readonly pixels: P;
}

/** A decoded photo: its model metadata plus the tiles a renderer draws. */
export interface LoadedImage<P> {
  readonly image: SourceImage;
  readonly tiles: readonly ImageTile<P>[];
}

/** Checks the file type before decoding. */
export function checkImageType(mimeType: string): Result<string, ImageLoadError> {
  return SUPPORTED_IMAGE_TYPES.includes(mimeType)
    ? ok(mimeType)
    : err({ kind: 'unsupported-type', mimeType });
}

/** Checks the decoded size against the memory budget. */
export function checkImageSize(widthPx: number, heightPx: number): Result<number, ImageLoadError> {
  const pixels = widthPx * heightPx;
  return pixels <= MAX_IMAGE_PIXELS ? ok(pixels) : err({ kind: 'too-large', pixels });
}

const errorMessages: {
  readonly [K in ImageLoadError['kind']]: (e: Extract<ImageLoadError, { kind: K }>) => string;
} = {
  'unsupported-type': (e) =>
    `Unsupported file type "${e.mimeType || 'unknown'}". Use PNG, JPEG or WebP.`,
  'too-large': (e) =>
    `Photo has ${(e.pixels / 1e6).toFixed(0)} MP; the limit is ${String(MAX_IMAGE_PIXELS / 1e6)} MP.`,
  'decode-failed': (e) => `Could not read the photo: ${e.reason}`,
};

/** Human-readable message for an import error. */
export function describeImageLoadError(error: ImageLoadError): string {
  const describe = errorMessages[error.kind] as (e: ImageLoadError) => string;
  return describe(error);
}
