import { expect, test, type Page } from '@playwright/test';
import { drawVia } from './support/editor';

// The board view starts at 4 px/mm with the board origin at its top-left corner, so board
// positions can be clicked directly (as in viaSizing.spec.ts).
const PX_PER_MM = 4;

interface Mm {
  readonly x: number;
  readonly y: number;
}

const CENTRE: Mm = { x: 20, y: 20 };
/** 3 mm right of the centre: a 6 mm pad (12 px radius), so the handle shows at this zoom. */
const EDGE: Mm = { x: 23, y: 20 };
const WIDER: Mm = { x: 24, y: 20 };
const NEXT: Mm = { x: 40, y: 20 };

async function screenOf(page: Page, p: Mm): Promise<Mm> {
  const box = await page.getByTestId('board-host').boundingBox();
  return { x: (box?.x ?? 0) + p.x * PX_PER_MM, y: (box?.y ?? 0) + p.y * PX_PER_MM };
}

async function clickAt(page: Page, p: Mm): Promise<void> {
  const s = await screenOf(page, p);
  await page.mouse.click(s.x, s.y);
}

const padAndDrill = async (page: Page): Promise<[string, string]> => [
  await page.getByLabel('Pad (mm)').inputValue(),
  await page.getByLabel('Drill (mm)').inputValue(),
];

test('resizes a selected via by its handle, undoes it, and uses the size for the next via', async ({
  page,
}) => {
  await page.goto('/');
  await page.keyboard.press('v');
  await drawVia(page, await screenOf(page, CENTRE), await screenOf(page, EDGE));
  await page.keyboard.press('s');
  await clickAt(page, CENTRE);
  expect(await padAndDrill(page)).toEqual(['6', '3']);

  // Drag the handle on the right edge 1 mm outwards: an 8 mm pad, the drill keeps its ratio.
  const handle = await screenOf(page, EDGE);
  const wider = await screenOf(page, WIDER);
  await page.mouse.move(handle.x, handle.y);
  await page.mouse.down();
  await page.mouse.move(wider.x, wider.y, { steps: 4 });
  await expect(page.getByLabel('Tool hint')).toContainText('Diameter 8 mm');
  await page.mouse.up();
  expect(await padAndDrill(page)).toEqual(['8', '4']);

  await page.keyboard.press('Control+z');
  await expect(page.getByLabel('Pad (mm)')).toHaveValue('6');

  // The resize set the via default, and undo does not change defaults.
  await page.keyboard.press('v');
  await clickAt(page, NEXT);
  await page.keyboard.press('s');
  await clickAt(page, NEXT);
  expect(await padAndDrill(page)).toEqual(['8', '4']);
});
