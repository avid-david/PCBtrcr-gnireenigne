import { expect, test, type Page } from '@playwright/test';

// The board view starts at 4 px/mm with the board origin at its top-left corner, so board
// positions can be clicked directly.
const PX_PER_MM = 4;

interface Mm {
  readonly x: number;
  readonly y: number;
}

const PAD_A: Mm = { x: 20, y: 20 };
const PAD_B: Mm = { x: 60, y: 20 };
const VIA: Mm = { x: 40, y: 40 };
const BEND: Mm = { x: 28, y: 34 };
const PAD_C: Mm = { x: 70, y: 52 };

async function screenOf(page: Page, p: Mm): Promise<Mm> {
  const box = await page.getByTestId('board-host').boundingBox();
  return { x: (box?.x ?? 0) + p.x * PX_PER_MM, y: (box?.y ?? 0) + p.y * PX_PER_MM };
}

async function clickAt(page: Page, p: Mm): Promise<void> {
  const s = await screenOf(page, p);
  await page.mouse.click(s.x, s.y);
}

/** Selects the feature at `p` with the select tool and returns the inspector's net label. */
async function netAt(page: Page, p: Mm): Promise<string> {
  await page.keyboard.press('s');
  await clickAt(page, p);
  const label = page.getByLabel('Net');
  await expect(label).toBeVisible();
  return (await label.textContent()) ?? '';
}

/** Rendered colour at a board position (the canvas keeps its drawing buffer). */
async function colorAt(page: Page, p: Mm): Promise<number[]> {
  const s = await screenOf(page, p);
  return page.evaluate(({ x, y }) => {
    const canvas = document.querySelector<HTMLCanvasElement>('.board canvas');
    const copy = document.createElement('canvas');
    const context = copy.getContext('2d');
    if (canvas === null || context === null) {
      return [];
    }
    copy.width = canvas.width;
    copy.height = canvas.height;
    context.drawImage(canvas, 0, 0);
    const box = canvas.getBoundingClientRect();
    const scale = canvas.width / box.width;
    const data = context.getImageData((x - box.left) * scale, (y - box.top) * scale, 1, 1).data;
    return [data[0] ?? 0, data[1] ?? 0, data[2] ?? 0];
  }, s);
}

async function drawBoard(page: Page): Promise<void> {
  await page.keyboard.press('p');
  await clickAt(page, PAD_A);
  await clickAt(page, PAD_B);
  await page.keyboard.press('v');
  await clickAt(page, VIA);
  await page.keyboard.press('t');
  for (const p of [PAD_A, BEND, VIA]) {
    await clickAt(page, p);
  }
  await page.keyboard.press('Enter');
  await page.keyboard.press('Tab');
  await expect(page.getByText('Layer: Bottom')).toBeVisible();
  await page.keyboard.press('p');
  await clickAt(page, PAD_C);
  await page.keyboard.press('t');
  await clickAt(page, VIA);
  await clickAt(page, PAD_C);
  await page.keyboard.press('Enter');
}

test('traces a small two-sided board; nets join through the via; undo/redo split and rejoin', async ({
  page,
}) => {
  await page.goto('/');
  await drawBoard(page);

  // Bottom is active: pad C and (through the via and both traces) pad A share a net.
  const bottomNet = await netAt(page, PAD_C);
  expect(bottomNet).toBe('Net 1 · 8 anchors');

  await page.keyboard.press('Tab');
  expect(await netAt(page, PAD_A)).toBe(bottomNet);
  expect(await netAt(page, PAD_B)).toBe('Net 2 · 1 anchor');

  // Clear the selection (click empty board) and compare drawn net colours on the top layer.
  await clickAt(page, { x: 5, y: 60 });
  await expect(page.getByLabel('Net')).toHaveCount(0);
  const viaColor = await colorAt(page, { x: VIA.x + 0.2, y: VIA.y });
  const padAColor = await colorAt(page, PAD_A);
  const padBColor = await colorAt(page, PAD_B);
  // The background is (21, 23, 26); make sure the samples really hit copper.
  expect(padAColor).not.toEqual([21, 23, 26]);
  expect(viaColor).toEqual(padAColor);
  expect(padBColor).not.toEqual(padAColor);

  // Undo the bottom trace: pad C is on its own again; redo joins it back.
  await page.keyboard.press('Control+z');
  await page.keyboard.press('Tab');
  expect(await netAt(page, PAD_C)).not.toBe(bottomNet);
  await page.keyboard.press('Control+y');
  expect(await netAt(page, PAD_C)).toBe(bottomNet);
});

test('a trace snaps to anchors and Esc throws away an unfinished one', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('v');
  await clickAt(page, VIA);
  await page.keyboard.press('t');
  await clickAt(page, { x: VIA.x + 1, y: VIA.y + 1 });
  await clickAt(page, { x: 10, y: 10 });
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Undo' })).toHaveAttribute(
    'title',
    'Undo Add via (Ctrl+Z)',
  );
  await clickAt(page, { x: VIA.x + 1, y: VIA.y + 1 });
  await clickAt(page, { x: 10, y: 10 });
  const end = await screenOf(page, { x: 10, y: 10 });
  await page.mouse.dblclick(end.x, end.y);
  expect(await netAt(page, VIA)).toBe('Net 1 · 3 anchors');
});
