import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';

// The board view starts at 4 px/mm with the board origin at its top-left corner, so board
// positions can be clicked directly (as in tracing.spec.ts).
const PX_PER_MM = 4;

interface Mm {
  readonly x: number;
  readonly y: number;
}

const A: Mm = { x: 10, y: 10 };
const B: Mm = { x: 30, y: 10 };
const C: Mm = { x: 50, y: 30 };
const D: Mm = { x: 70, y: 10 };

async function clickAt(page: Page, p: Mm): Promise<void> {
  const box = await page.getByTestId('board-host').boundingBox();
  await page.mouse.click((box?.x ?? 0) + p.x * PX_PER_MM, (box?.y ?? 0) + p.y * PX_PER_MM);
}

/** Picks the trace tool from the toolbar (a key would type into a focused name field). */
async function traceBetween(page: Page, from: Mm, to: Mm): Promise<void> {
  await page.getByRole('button', { name: 'Trace', exact: true }).click();
  await clickAt(page, from);
  await clickAt(page, to);
  // The toolbar button does not keep focus, so Enter reaches the trace tool.
  await page.keyboard.press('Enter');
}

async function rename(page: Page, from: string, to: string): Promise<void> {
  const name = page.getByLabel(`Name of ${from}`, { exact: true });
  await name.fill(to);
  await name.press('Enter');
  await expect(page.getByLabel(`Name of ${to}`, { exact: true })).toBeVisible();
}

test('renames, merges, highlights, locks and exports nets; switches to mil', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('v');
  for (const p of [A, B, C, D]) {
    await clickAt(page, p);
  }
  await traceBetween(page, A, B);

  await page.getByRole('tab', { name: 'Nets' }).click();
  await rename(page, 'Net 1', 'BIG');
  await rename(page, 'Net 3', 'SMALL');

  // Joining the two named nets keeps the larger net's name and says so.
  await traceBetween(page, B, D);
  await expect(page.getByRole('status', { name: 'Notice' })).toContainText('Joined SMALL into BIG');
  await expect(page.getByLabel('Name of SMALL', { exact: true })).toHaveCount(0);
  await expect(page.getByLabel('Name of BIG', { exact: true })).toBeVisible();

  const highlight = page.getByRole('button', { name: 'Highlight BIG' });
  await highlight.click();
  await expect(highlight).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('Escape');
  await expect(highlight).toHaveAttribute('aria-pressed', 'false');

  // A locked net's vias cannot be selected; the other via still can.
  await page.getByRole('checkbox', { name: 'Lock BIG' }).check();
  await page.getByRole('tab', { name: 'Layers' }).click();
  await page.getByRole('button', { name: 'Select', exact: true }).click();
  await clickAt(page, A);
  await expect(page.getByLabel('Net', { exact: true })).toHaveCount(0);
  await clickAt(page, C);
  await expect(page.getByLabel('Net', { exact: true })).toHaveText(/^Net 2 · 1 anchor$/);

  await page.getByRole('tab', { name: 'Nets' }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export Netlist (CSV)' }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe('board.csv');
  const rows = (await readFile(await file.path(), 'utf8')).trim().split('\r\n');
  expect(rows[0]).toBe('net,member');
  expect(rows.filter((r) => r.startsWith('BIG,via:'))).toHaveLength(3);
  expect(rows.filter((r) => r.startsWith('Net 2,via:'))).toHaveLength(1);

  // Lengths show in mil once chosen: the default 0.3 mm via drill is 11.81 mil.
  await page.getByRole('button', { name: 'mil', exact: true }).click();
  await page.getByRole('tab', { name: 'Layers' }).click();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Via', exact: true }).click();
  await expect(page.getByLabel('Drill (mil)')).toHaveValue('11.81');
});

test('lists every shortcut in the help overlay', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('?');
  const help = page.getByRole('dialog', { name: 'Keyboard shortcuts' });
  await expect(help).toContainText('Plane tool');
  await expect(help).toContainText('Ctrl+Shift+Z');
  await page.keyboard.press('Escape');
  await expect(help).toHaveCount(0);
});
