import { readFile } from 'node:fs/promises';
import { expect, type Page } from '@playwright/test';
import { BOARD, bottomPhoto, topPhoto } from './boardPhotos';
import type { Rgb } from './png';

// Editor actions shared by the e2e tests.

export interface ScreenPoint {
  readonly x: number;
  readonly y: number;
}

const TOLERANCE = 40;

/**
 * Centre (page CSS pixels) of the pixels on the board canvas that have the given colour, or
 * `null` when none are visible. This is how the test "sees" a via or corner, like a user.
 */
export async function findBlob(page: Page, color: Rgb): Promise<ScreenPoint | null> {
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

export async function clickBlob(page: Page, color: Rgb): Promise<void> {
  await expect.poll(() => findBlob(page, color)).not.toBeNull();
  const at = await findBlob(page, color);
  await page.mouse.click(at?.x ?? 0, at?.y ?? 0);
}

export async function importPhoto(
  page: Page,
  layer: 'top' | 'bottom',
  buffer: Buffer,
): Promise<void> {
  const name = `${layer}.png`;
  await page
    .getByLabel(`Import ${layer} photo…`)
    .setInputFiles({ name, mimeType: 'image/png', buffer });
  await expect(page.getByRole('status', { name: 'Notice' })).toHaveText(`Imported ${name}`);
}

/** Imports both photos, enters align mode, sets the board size and shows only the active photo. */
export async function startAligning(page: Page): Promise<void> {
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

/** Saves with Ctrl+S and returns the downloaded file's name and bytes. */
export async function save(page: Page): Promise<{ name: string; bytes: Uint8Array }> {
  const download = page.waitForEvent('download');
  await page.keyboard.press('Control+s');
  const file = await download;
  return { name: file.suggestedFilename(), bytes: await readFile(await file.path()) };
}

/**
 * Draws a via to size with the active Via tool (SPEC F7): presses at its centre and releases
 * at its edge, in screen pixels. The first via of a session must be drawn this way.
 */
export async function drawVia(page: Page, centre: ScreenPoint, edge: ScreenPoint): Promise<void> {
  await page.mouse.move(centre.x, centre.y);
  await page.mouse.down();
  await page.mouse.move(edge.x, edge.y, { steps: 4 });
  await page.mouse.up();
}
