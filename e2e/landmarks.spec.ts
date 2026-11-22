import { expect, test, type Page } from '@playwright/test';
import { CORNER_COLORS, VIAS } from './support/boardPhotos';
import { clickBlob, drawVia, findBlob, startAligning, type ScreenPoint } from './support/editor';
import type { Rgb } from './support/png';

// SPEC F9 / M9: on the synthetic photos with a deliberately mis-aligned bottom, placing a via
// on the bottom over one placed on the top offers a landmark, and accepting lowers the RMS.

const CORNERS = ['tl', 'tr', 'br', 'bl'] as const;

/** Two vias matched on purpose a few screen px off on the bottom photo. */
const MISMATCHED: readonly { readonly color: Rgb; readonly offset: ScreenPoint }[] = [
  { color: VIAS[4]?.color ?? [0, 0, 0], offset: { x: 16, y: 0 } },
  { color: VIAS[5]?.color ?? [0, 0, 0], offset: { x: -11, y: 11 } },
];

/** The vias used as landmarks. */
const LANDMARK_COLORS: readonly Rgb[] = [VIAS[0]?.color ?? [0, 0, 0], VIAS[1]?.color ?? [0, 0, 0]];

const activeLayer = (page: Page) => page.getByText(/^Layer: /);
const bottomAlignment = (page: Page) => page.getByRole('region', { name: 'Bottom alignment' });

/** Where a blob is once the canvas has settled after a layer switch (two equal reads). */
async function settledBlob(page: Page, color: Rgb): Promise<ScreenPoint> {
  const seen: { last: ScreenPoint | null } = { last: null };
  await expect
    .poll(async () => {
      const now = await findBlob(page, color);
      const last = seen.last;
      seen.last = now;
      return now !== null && last !== null && now.x === last.x && now.y === last.y;
    })
    .toBe(true);
  return seen.last ?? { x: 0, y: 0 };
}

async function bottomRms(page: Page): Promise<number> {
  const text = (await bottomAlignment(page).textContent()) ?? '';
  return Number(/RMS (\d+\.\d+) mm/.exec(text)?.[1]);
}

/** Top aligned by its corners; bottom by its corners and two vias matched off on purpose. */
async function misalignBottom(page: Page): Promise<void> {
  for (const corner of CORNERS) {
    await clickBlob(page, CORNER_COLORS[corner]);
  }
  await page.keyboard.press('Tab');
  await page.getByRole('button', { name: 'Corners' }).click();
  for (const corner of CORNERS) {
    await clickBlob(page, CORNER_COLORS[corner]);
  }
  for (const { color, offset } of MISMATCHED) {
    await expect(activeLayer(page)).toHaveText('Layer: Bottom');
    const at = await settledBlob(page, color);
    await page.mouse.click(at.x + offset.x, at.y + offset.y);
    await expect(activeLayer(page)).toHaveText('Layer: Top');
    await clickBlob(page, color);
  }
  await expect(bottomAlignment(page)).toContainText('Aligned with 6 points');
}

/**
 * Places a via on the hole in the top photo, then one on the same hole in the bottom photo, and
 * uses the pair as a landmark. Both holes are found before any via covers them.
 */
async function acceptLandmark(page: Page, color: Rgb, first: boolean): Promise<void> {
  await expect(activeLayer(page)).toHaveText('Layer: Top');
  const onTop = await settledBlob(page, color);
  await page.keyboard.press('Tab');
  await expect(activeLayer(page)).toHaveText('Layer: Bottom');
  const onBottom = await settledBlob(page, color);
  await page.keyboard.press('Tab');
  if (first) {
    await drawVia(page, onTop, { x: onTop.x + 20, y: onTop.y });
  } else {
    await page.mouse.click(onTop.x, onTop.y);
  }
  await page.keyboard.press('Tab');
  await page.mouse.click(onBottom.x, onBottom.y);
  const offer = page.getByRole('group', { name: 'Landmark offer' });
  await expect(offer).toContainText('same via?');
  await offer.getByRole('button', { name: 'Use as landmark' }).click();
  await expect(offer).toHaveCount(0);
  await page.keyboard.press('Tab');
}

test('accepting landmarks from overlapping vias lowers the RMS', async ({ page }) => {
  test.setTimeout(90_000);
  await startAligning(page);
  await misalignBottom(page);
  const before = await bottomRms(page);
  expect(before).toBeGreaterThan(0.2);

  // Leave align mode so no markers cover the holes, and trace with the Via tool on the top.
  await page.keyboard.press('a');
  await page.keyboard.press('v');
  await page.keyboard.press('Tab');
  for (const [i, color] of LANDMARK_COLORS.entries()) {
    await acceptLandmark(page, color, i === 0);
  }

  await page.keyboard.press('a');
  await expect(bottomAlignment(page)).toContainText('Aligned with 8 points');
  const after = await bottomRms(page);
  expect(after).toBeLessThan(before);

  // Accepting was one step: undo brings the second via back and removes its match.
  await page.keyboard.press('Control+z');
  await expect(bottomAlignment(page)).toContainText('Aligned with 7 points');
});
