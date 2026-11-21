import { expect, test, type Page } from '@playwright/test';
import { BOARD, CORNER_COLORS, VIAS, bottomPhoto, topPhoto } from './support/boardPhotos';
import type { Rgb } from './support/png';

interface ScreenPoint {
  readonly x: number;
  readonly y: number;
}

const TOLERANCE = 40;

/**
 * Centre (page CSS pixels) of the pixels on the board canvas that have the given colour, or
 * `null` when none are visible. This is how the test "sees" a via or corner, like a user.
 */
async function findBlob(page: Page, color: Rgb): Promise<ScreenPoint | null> {
  return page.evaluate(
    ({ rgb, tolerance }) => {
      const canvas = document.querySelector<HTMLCanvasElement>('.board canvas');
      const copy = document.createElement('canvas');
      const context = copy.getContext('2d', { willReadFrequently: true });
      if (canvas === null || context === null) {
        return null;
      }
      copy.width = canvas.width;
      copy.height = canvas.height;
      context.drawImage(canvas, 0, 0);
      const { data } = context.getImageData(0, 0, copy.width, copy.height);
      const matches = (i: number) =>
        rgb.every((c, k) => Math.abs((data[i + k] ?? -999) - c) <= tolerance);
      const hits = Array.from({ length: data.length / 4 }, (_, p) => p).filter((p) =>
        matches(p * 4),
      );
      const box = canvas.getBoundingClientRect();
      const scale = box.width / canvas.width;
      const mean = (values: number[]) => values.reduce((s, v) => s + v, 0) / values.length;
      return hits.length === 0
        ? null
        : {
            x: box.left + (mean(hits.map((p) => p % copy.width)) + 0.5) * scale,
            y: box.top + (mean(hits.map((p) => Math.floor(p / copy.width))) + 0.5) * scale,
          };
    },
    { rgb: color, tolerance: TOLERANCE },
  );
}

async function clickBlob(page: Page, color: Rgb): Promise<void> {
  await expect.poll(() => findBlob(page, color)).not.toBeNull();
  const at = await findBlob(page, color);
  await page.mouse.click(at?.x ?? 0, at?.y ?? 0);
}

async function importPhoto(page: Page, layer: 'top' | 'bottom', buffer: Buffer): Promise<void> {
  const name = `${layer}.png`;
  await page
    .getByLabel(`Import ${layer} photo…`)
    .setInputFiles({ name, mimeType: 'image/png', buffer });
  await expect(page.getByRole('status', { name: 'Notice' })).toHaveText(`Imported ${name}`);
}

/** Imports both photos, enters align mode, sets the board size and shows only the active photo. */
async function startAligning(page: Page): Promise<void> {
  await page.goto('/');
  await importPhoto(page, 'top', topPhoto());
  await importPhoto(page, 'bottom', bottomPhoto());
  await page.keyboard.press('a');
  await page.getByLabel('Width (mm)').fill(String(BOARD.widthMm));
  await page.getByLabel('Height (mm)').fill(String(BOARD.heightMm));
  await page.getByRole('button', { name: 'Set size' }).click();
  await page.getByLabel('Overlay opacity').fill('0');
  await page.getByTestId('board-host').hover();
  await page.keyboard.press('Home');
}

async function matchVias(page: Page): Promise<void> {
  const activeLayer = page.getByText(/^Layer: /);
  for (const via of VIAS) {
    await expect(activeLayer).toHaveText('Layer: Top');
    await clickBlob(page, via.color);
    await expect(activeLayer).toHaveText('Layer: Bottom');
    await clickBlob(page, via.color);
  }
}

/** How far (CSS px) a via moves on screen between showing only the top and only the bottom. */
async function viaShift(page: Page, color: Rgb): Promise<number> {
  await page.getByLabel('Overlay opacity').fill('100');
  const bottom = await findBlob(page, color);
  await page.getByLabel('Overlay opacity').fill('0');
  const top = await findBlob(page, color);
  return bottom === null || top === null
    ? Number.POSITIVE_INFINITY
    : Math.hypot(bottom.x - top.x, bottom.y - top.y);
}

test('aligns both photos by clicking corners and matching vias', async ({ page }) => {
  test.setTimeout(60_000);
  await startAligning(page);

  await expect(page.getByRole('status', { name: 'Alignment hint' })).toContainText(
    'top-left corner on the Top photo',
  );
  for (const corner of ['tl', 'tr', 'br', 'bl'] as const) {
    await clickBlob(page, CORNER_COLORS[corner]);
  }
  await expect(page.getByRole('region', { name: 'Top alignment' })).toContainText(
    'Aligned with 4 points',
  );

  await matchVias(page);
  const bottom = page.getByRole('region', { name: 'Bottom alignment' });
  await expect(bottom).toContainText('Aligned with 6 points');
  const rms = Number(/RMS (\d+\.\d+) mm/.exec((await bottom.textContent()) ?? '')?.[1]);
  expect(rms).toBeLessThan(0.2);
  await expect(bottom.getByText('outlier')).toHaveCount(0);
  const panelOverflow = await page.evaluate(() => {
    const panel = document.querySelector('.shell__panel');
    return panel === null ? -1 : panel.scrollWidth - panel.clientWidth;
  });
  expect(panelOverflow).toBe(0);

  // Leave align mode so no markers cover the vias, then check the photos coincide.
  await page.keyboard.press('a');
  expect(await viaShift(page, [255, 0, 128])).toBeLessThan(2);
});
