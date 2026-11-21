import { expect, test, type Page } from '@playwright/test';
import { makePng, type Rgb } from './support/png';

const RED: Rgb = [255, 0, 0];
const GREEN: Rgb = [0, 255, 0];
const BLUE: Rgb = [0, 0, 255];

// Top photo: plain red. Bottom photo: blue left half, green right half, so mirroring is visible.
const topPhoto = makePng(200, 100, () => RED);
const bottomPhoto = makePng(200, 100, (x) => (x < 100 ? BLUE : GREEN));

/** Reads the rendered colour at a fraction of the board canvas (0–1 in each direction). */
async function pixelAt(page: Page, fx: number, fy: number): Promise<number[]> {
  return page.evaluate(
    ({ x, y }) => {
      const canvas = document.querySelector<HTMLCanvasElement>('.board canvas');
      const copy = document.createElement('canvas');
      const context = copy.getContext('2d');
      if (canvas === null || context === null) {
        return [];
      }
      copy.width = canvas.width;
      copy.height = canvas.height;
      context.drawImage(canvas, 0, 0);
      const data = context.getImageData(
        Math.floor(canvas.width * x),
        Math.floor(canvas.height * y),
        1,
        1,
      ).data;
      return [data[0] ?? 0, data[1] ?? 0, data[2] ?? 0];
    },
    { x: fx, y: fy },
  );
}

/** Polls until the pixel is close to the expected colour (rendering happens on the next frame). */
async function expectColor(page: Page, fx: number, expected: Rgb): Promise<void> {
  await expect
    .poll(async () => {
      const actual = await pixelAt(page, fx, 0.5);
      return actual.every((v, i) => Math.abs(v - (expected[i] ?? 0)) <= 40);
    })
    .toBe(true);
}

interface Photo {
  readonly layer: 'top' | 'bottom';
  readonly name: string;
  readonly buffer: Buffer;
}

async function importPhoto(page: Page, { layer, name, buffer }: Photo) {
  await page
    .getByLabel(`Import ${layer} photo…`)
    .setInputFiles({ name, mimeType: 'image/png', buffer });
  await expect(page.getByRole('status', { name: 'Notice' })).toHaveText(`Imported ${name}`);
}

const LEFT = 0.35;
const RIGHT = 0.65;

test('imports both photos, overlays them, switches layers and mirrors', async ({ page }) => {
  await page.goto('/');
  await importPhoto(page, { layer: 'top', name: 'top.png', buffer: topPhoto });
  await expectColor(page, LEFT, RED);

  await importPhoto(page, { layer: 'bottom', name: 'bottom.png', buffer: bottomPhoto });
  // The bottom photo is mirrored by default: its green half appears on the left, over red at 50 %.
  await expectColor(page, LEFT, [128, 128, 0]);

  await page.getByLabel('Overlay opacity').fill('0');
  await expectColor(page, LEFT, RED);

  await page.keyboard.press('Tab');
  await expect(page.getByText('Layer: Bottom')).toBeVisible();
  await expectColor(page, LEFT, GREEN);
  await expectColor(page, RIGHT, BLUE);

  await page
    .getByRole('group', { name: /^Bottom/ })
    .getByLabel('Mirror horizontally')
    .uncheck();
  await expectColor(page, LEFT, BLUE);

  await page.getByLabel('Overlay opacity').fill('100');
  await expectColor(page, LEFT, RED);
});

test('hides a photo, zooms with the wheel and fits back with Home', async ({ page }) => {
  await page.goto('/');
  await importPhoto(page, { layer: 'top', name: 'top.png', buffer: topPhoto });
  const zoomText = page.getByText(/^Zoom: /);
  const fitted = await zoomText.textContent();

  const board = page.getByTestId('board-host');
  await board.hover();
  await page.mouse.wheel(0, -500);
  await expect(zoomText).not.toHaveText(fitted ?? '');

  await page.keyboard.press('Home');
  await expect(zoomText).toHaveText(fitted ?? '');

  await page.getByRole('group', { name: /^Top/ }).getByLabel('Show photo').uncheck();
  await expectColor(page, LEFT, [21, 23, 26]);
});

test('rejects unsupported files with a message', async ({ page }) => {
  await page.goto('/');
  await page
    .getByLabel('Import top photo…')
    .setInputFiles({ name: 'board.gif', mimeType: 'image/gif', buffer: Buffer.from('GIF89a') });
  await expect(page.getByRole('status', { name: 'Notice' })).toHaveText(
    'Unsupported file type "image/gif". Use PNG, JPEG or WebP.',
  );
});
