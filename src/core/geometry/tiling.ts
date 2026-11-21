/** A rectangle in whole image pixels. */
export interface PixelRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/**
 * Largest tile edge in pixels. Many GPUs cap textures at 8192 px; 4096 keeps every tile
 * well inside that limit while keeping the tile count low (see docs/adr/0003).
 */
export const MAX_TILE_SIZE = 4096;

const spans = (length: number, tileSize: number): { start: number; size: number }[] =>
  Array.from({ length: Math.ceil(length / tileSize) }, (_, i) => ({
    start: i * tileSize,
    size: Math.min(tileSize, length - i * tileSize),
  }));

/** Splits an image into non-overlapping tiles that exactly cover it, row by row. */
export function tileGrid(width: number, height: number, tileSize = MAX_TILE_SIZE): PixelRect[] {
  const columns = spans(width, tileSize);
  return spans(height, tileSize).flatMap((row) =>
    columns.map((col) => ({ x: col.start, y: row.start, width: col.size, height: row.size })),
  );
}
