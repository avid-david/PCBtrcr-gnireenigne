import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { MAX_TILE_SIZE, tileGrid } from './tiling';

const size = fc.integer({ min: 1, max: 20_000 });
const tile = fc.integer({ min: 64, max: 8192 });

describe('tileGrid', () => {
  it('splits large photos into tiles of at most 4096 px', () => {
    const tiles = tileGrid(6000, 4000);
    expect(tiles).toHaveLength(2);
    expect(tiles.every((t) => t.width <= MAX_TILE_SIZE && t.height <= MAX_TILE_SIZE)).toBe(true);
    expect(tileGrid(6000, 5000)).toHaveLength(4);
  });

  it('tiles exactly cover the image without overlap', () => {
    fc.assert(
      fc.property(size, size, tile, (w, h, t) => {
        const tiles = tileGrid(w, h, t);
        const area = tiles.reduce((sum, r) => sum + r.width * r.height, 0);
        const inside = tiles.every(
          (r) => r.x >= 0 && r.y >= 0 && r.x + r.width <= w && r.y + r.height <= h,
        );
        return area === w * h && inside;
      }),
    );
  });

  it('never produces a tile larger than the limit', () => {
    fc.assert(
      fc.property(size, size, tile, (w, h, t) =>
        tileGrid(w, h, t).every(
          (r) => r.width <= t && r.height <= t && r.width > 0 && r.height > 0,
        ),
      ),
    );
  });
});
