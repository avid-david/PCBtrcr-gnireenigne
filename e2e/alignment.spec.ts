import { expect, test, type Page } from '@playwright/test';
import { CORNER_COLORS, VIAS } from './support/boardPhotos';
import { clickBlob, findBlob, startAligning } from './support/editor';
import type { Rgb } from './support/png';

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
