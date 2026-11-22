import { expect, test, type Page } from '@playwright/test';
import { drawVia } from './support/editor';

// The board view starts at 4 px/mm with the board origin at its top-left corner, so board
// positions can be clicked directly (as in tracing.spec.ts).
const PX_PER_MM = 4;

interface Mm {
  readonly x: number;
  readonly y: number;
}

const FIRST: Mm = { x: 20, y: 20 };
const SECOND: Mm = { x: 40, y: 20 };
const THIRD: Mm = { x: 60, y: 20 };
const ARMED_CLICK: Mm = { x: 20, y: 40 };
const AFTER_ESC: Mm = { x: 40, y: 40 };

async function screenOf(page: Page, p: Mm): Promise<Mm> {
  const box = await page.getByTestId('board-host').boundingBox();
  return { x: (box?.x ?? 0) + p.x * PX_PER_MM, y: (box?.y ?? 0) + p.y * PX_PER_MM };
}

async function clickAt(page: Page, p: Mm): Promise<void> {
  const s = await screenOf(page, p);
  await page.mouse.click(s.x, s.y);
}

const hint = (page: Page) => page.getByLabel('Tool hint');

/** Selects what is at `p` and returns its pad and drill as the inspector shows them. */
async function viaSizeAt(page: Page, p: Mm): Promise<[string, string]> {
  await page.keyboard.press('s');
  await clickAt(page, p);
  return [
    await page.getByLabel('Pad (mm)').inputValue(),
    await page.getByLabel('Drill (mm)').inputValue(),
  ];
}

test('shows the tools in labelled groups', async ({ page }) => {
  await page.goto('/');
  const tools = page.getByRole('navigation', { name: 'Tools' });
  for (const group of ['Connections', 'Components', 'Annotations', 'Align']) {
    await expect(tools.getByRole('group', { name: group })).toContainText(group);
  }
  await expect(
    tools.getByRole('group', { name: 'Connections' }).getByRole('button', { name: 'Plane' }),
  ).toBeVisible();
});

test('draws the first via to size, clicks two more of that size, and Shift+V arms again', async ({
  page,
}) => {
  await page.goto('/');
  await page.keyboard.press('v');
  await expect(hint(page)).toContainText('Drag from the centre of a via to its edge');

  // 2 mm from the centre: a 4 mm pad, and the drill keeps the default ratio (0.3 / 0.6).
  await drawVia(page, await screenOf(page, FIRST), await screenOf(page, { x: 22, y: 20 }));
  await clickAt(page, SECOND);
  await clickAt(page, THIRD);
  await expect(hint(page)).toContainText('Click to place a via');
  for (const p of [FIRST, SECOND, THIRD]) {
    expect(await viaSizeAt(page, p)).toEqual(['4', '2']);
  }

  // Shift+V: the next click places nothing until Esc disarms the tool.
  await page.keyboard.press('Shift+V');
  await expect(page.getByRole('button', { name: 'Via', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(hint(page)).toContainText('Drag from the centre of a via to its edge');
  await clickAt(page, ARMED_CLICK);
  await page.keyboard.press('Escape');
  await clickAt(page, AFTER_ESC);
  await page.keyboard.press('s');
  await clickAt(page, ARMED_CLICK);
  await expect(page.getByLabel('Net', { exact: true })).toHaveCount(0);
  expect(await viaSizeAt(page, AFTER_ESC)).toEqual(['4', '2']);
});
