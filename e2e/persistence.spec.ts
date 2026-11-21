import { expect, test, type Page } from '@playwright/test';
import { strFromU8, unzipSync } from 'fflate';
import { bottomPhoto, CORNER_COLORS, topPhoto } from './support/boardPhotos';
import { clickBlob, importPhoto, save, startAligning } from './support/editor';

interface Autosaved {
  readonly dirty: boolean;
  readonly json: string;
}

/** The autosave record in IndexedDB, read directly from the database. */
async function autosaved(page: Page): Promise<Autosaved | null> {
  return page.evaluate(
    () =>
      new Promise<Autosaved | null>((resolve) => {
        const open = indexedDB.open('pcb-reverse-tracer');
        open.onsuccess = () => {
          const db = open.result;
          if (!db.objectStoreNames.contains('autosave')) {
            resolve(null);
            return;
          }
          const get = db.transaction('autosave').objectStore('autosave').get('autosave');
          get.onsuccess = () => {
            resolve((get.result as Autosaved | undefined) ?? null);
          };
        };
      }),
  );
}

/** Clicks points inside the board view, given as fractions of its size, with the current tool. */
async function clickBoard(page: Page, points: readonly [number, number][]): Promise<void> {
  const box = await page.getByTestId('board-host').boundingBox();
  if (box === null) {
    throw new Error('board view is not visible');
  }
  for (const [fx, fy] of points) {
    await page.mouse.click(box.x + box.width * fx, box.y + box.height * fy);
  }
}

/** How many features an autosave holds (dirty ones only). */
const featureCount = (record: Autosaved | null): number =>
  record?.dirty === true
    ? (JSON.parse(record.json) as { project: { features: unknown[] } }).project.features.length
    : -1;

const fileLabel = (page: Page) => page.getByLabel('Project file', { exact: true });
const notice = (page: Page) => page.getByRole('status', { name: 'Notice' });
const banner = (page: Page) => page.getByRole('region', { name: 'Recover unsaved work' });

test('saves a project, reloads the page and opens it again unchanged', async ({ page }) => {
  test.setTimeout(60_000);
  await startAligning(page);
  for (const corner of ['tl', 'tr', 'br', 'bl'] as const) {
    await clickBlob(page, CORNER_COLORS[corner]);
  }
  await page.keyboard.press('a');
  await page.keyboard.press('v');
  await clickBoard(page, [[0.4, 0.4]]);
  await page.keyboard.press('t');
  await clickBoard(page, [
    [0.4, 0.4],
    [0.6, 0.5],
  ]);
  await page.keyboard.press('Enter');
  await expect(fileLabel(page)).toContainText('unsaved changes');

  const first = await save(page);
  expect(first.name).toBe('board.pcbrt');
  await expect(fileLabel(page)).toHaveText('board.pcbrt');
  await expect.poll(async () => (await autosaved(page))?.dirty).toBe(false);

  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(banner(page)).toHaveCount(0);
  await page.getByLabel('Open project file').setInputFiles({
    name: 'board.pcbrt',
    mimeType: 'application/zip',
    buffer: Buffer.from(first.bytes),
  });
  await expect(notice(page)).toHaveText('Opened board');
  await expect(fileLabel(page)).toHaveText('board.pcbrt');
  await expect(page.getByRole('button', { name: 'Undo' })).toBeDisabled();

  const second = await save(page);
  const [a, b] = [unzipSync(first.bytes), unzipSync(second.bytes)];
  expect(Object.keys(b).sort()).toEqual(Object.keys(a).sort());
  for (const [path, bytes] of Object.entries(a)) {
    expect(Buffer.from(b[path] ?? []).equals(Buffer.from(bytes)), path).toBe(true);
  }
  const project = JSON.parse(strFromU8(a['project.json'] ?? new Uint8Array())) as {
    project: { board: unknown; features: { kind: string }[]; layers: { corners: object }[] };
  };
  expect(project.project.board).toEqual({ widthMm: 80, heightMm: 50 });
  expect(project.project.features.map((f) => f.kind)).toEqual(['via', 'trace']);
  expect(Object.keys(project.project.layers[0]?.corners ?? {})).toHaveLength(4);
  expect(Object.keys(a).filter((p) => p.startsWith('images/'))).toHaveLength(2);
});

test('offers to restore unsaved work after a reload, and can discard it', async ({ page }) => {
  await page.goto('/');
  await importPhoto(page, 'top', topPhoto());
  await importPhoto(page, 'bottom', bottomPhoto());
  await page.keyboard.press('v');
  await clickBoard(page, [[0.5, 0.5]]);
  await expect.poll(async () => featureCount(await autosaved(page))).toBe(1);

  await page.reload();
  await expect(banner(page)).toContainText('Unsaved work on “board”');
  await banner(page).getByRole('button', { name: 'Restore' }).click();
  await expect(notice(page)).toHaveText('Restored unsaved work.');
  await expect(banner(page)).toHaveCount(0);
  await expect(fileLabel(page)).toContainText('unsaved changes');

  const restored = unzipSync((await save(page)).bytes);
  const json = JSON.parse(strFromU8(restored['project.json'] ?? new Uint8Array())) as {
    project: { features: { kind: string }[] };
  };
  expect(json.project.features.map((f) => f.kind)).toEqual(['via']);
  expect(Object.keys(restored).filter((p) => p.startsWith('images/'))).toHaveLength(2);

  // Unsaved again, then discarded: the next start offers nothing.
  await page.keyboard.press('v');
  await clickBoard(page, [[0.3, 0.3]]);
  await expect.poll(async () => featureCount(await autosaved(page))).toBe(2);
  await page.reload();
  await banner(page).getByRole('button', { name: 'Discard' }).click();
  await expect(banner(page)).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(banner(page)).toHaveCount(0);
});
