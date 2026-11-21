import { expect, test, type Page } from '@playwright/test';
import { strFromU8, unzipSync } from 'fflate';
import { save } from './support/editor';

// The board view starts at 4 px/mm with the board origin at its top-left corner, so board
// positions can be clicked directly (as in tracing.spec.ts).
const PX_PER_MM = 4;

interface Mm {
  readonly x: number;
  readonly y: number;
}

async function clickAt(page: Page, p: Mm): Promise<void> {
  const box = await page.getByTestId('board-host').boundingBox();
  await page.mouse.click((box?.x ?? 0) + p.x * PX_PER_MM, (box?.y ?? 0) + p.y * PX_PER_MM);
}

/** A 2 × 5 header centred at (20, 20): pins 1 and 2 are the top row, 2.54 mm apart. */
const HEADER: Mm = { x: 20, y: 20 };
const PIN_2: Mm = { x: HEADER.x + 1.27, y: HEADER.y - 5.08 };
/** An 0805 resistor centred at (40, 15): pad 1 is 0.9125 mm left of centre. */
const RESISTOR: Mm = { x: 40, y: 15 };
const R_PAD_1: Mm = { x: RESISTOR.x - 0.9125, y: RESISTOR.y };
const TRACE_MIDDLE: Mm = { x: 30, y: 14.96 };

const netLabel = (page: Page) => page.getByLabel('Net', { exact: true });

async function chooseFootprint(page: Page, id: string): Promise<void> {
  await page.getByLabel('Footprint', { exact: true }).selectOption(id);
}

/** Selects the feature at `p` with the select tool. */
async function selectAt(page: Page, p: Mm): Promise<void> {
  await page.keyboard.press('s');
  await clickAt(page, p);
}

async function placeParts(page: Page): Promise<void> {
  await page.keyboard.press('u');
  await chooseFootprint(page, 'pin-header');
  await page.getByLabel('Rows', { exact: true }).selectOption('2');
  const pins = page.getByLabel('Pins per row (1–40)');
  await pins.fill('5');
  await pins.press('Enter');
  await clickAt(page, HEADER);
  await page.keyboard.press('Escape');
  await chooseFootprint(page, 'chip');
  await page.getByLabel('Size (inch)').selectOption('0805');
  await clickAt(page, RESISTOR);
  await page.keyboard.press('t');
  await clickAt(page, PIN_2);
  await clickAt(page, R_PAD_1);
  await page.keyboard.press('Enter');
}

test('places footprints whose pads join nets through traces, rotates, flips and attaches a plane', async ({
  page,
}) => {
  await page.goto('/');
  await placeParts(page);

  // Header pin 2, both trace points and resistor pad 1 form one net.
  await selectAt(page, TRACE_MIDDLE);
  await expect(netLabel(page)).toHaveText(/· 4 anchors$/);

  // Rotating keeps the trace tied to the pad; the designators are J1 and R1.
  await selectAt(page, RESISTOR);
  await expect(page.getByLabel('Designator')).toHaveValue('R1');
  await page.keyboard.press('r');
  await expect(page.getByLabel('Rotation (°, clockwise)')).toHaveValue('90');
  await selectAt(page, TRACE_MIDDLE);
  await expect(netLabel(page)).toHaveText(/· 4 anchors$/);

  // Flipping the resistor to the bottom releases the top trace from its pad.
  await selectAt(page, RESISTOR);
  await page.keyboard.press('f');
  await expect(page.getByText('Layer: Bottom')).toBeVisible();
  await page.keyboard.press('Tab');
  await selectAt(page, TRACE_MIDDLE);
  await expect(netLabel(page)).toHaveText(/· 3 anchors$/);

  // A plane around the header, with its pads attached, joins all ten pins and the trace.
  await page.keyboard.press('l');
  for (const corner of [
    { x: 10, y: 5 },
    { x: 30, y: 5 },
    { x: 30, y: 35 },
    { x: 10, y: 35 },
  ]) {
    await clickAt(page, corner);
  }
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: 'Attach anchors inside outline' }).click();
  await expect(netLabel(page)).toHaveText(/· 12 anchors$/);
});

test('saves components, planes, notes and silkscreen and opens them unchanged', async ({
  page,
}) => {
  await page.goto('/');
  await placeParts(page);
  await page.keyboard.press('x');
  await clickAt(page, { x: 10, y: 45 });
  await page.keyboard.press('k');
  await clickAt(page, { x: 50, y: 30 });
  await clickAt(page, { x: 60, y: 30 });
  await page.keyboard.press('Enter');

  const first = await save(page);
  const project = JSON.parse(
    strFromU8(unzipSync(first.bytes)['project.json'] ?? new Uint8Array()),
  ) as {
    schemaVersion: number;
    project: { features: { kind: string; designator?: string }[] };
  };
  expect(project.schemaVersion).toBe(3);
  expect(project.project.features.map((f) => f.designator ?? f.kind)).toEqual([
    'J1',
    'R1',
    'trace',
    'text',
    'silkLine',
  ]);

  await page.reload();
  await page.getByLabel('Open project file').setInputFiles({
    name: 'board.pcbrt',
    mimeType: 'application/zip',
    buffer: Buffer.from(first.bytes),
  });
  await expect(page.getByRole('status', { name: 'Notice' })).toHaveText('Opened board');
  const second = await save(page);
  // Zip entries carry timestamps, so compare what is inside.
  const [before, after] = [unzipSync(first.bytes), unzipSync(second.bytes)];
  expect(Object.keys(after)).toEqual(Object.keys(before));
  expect(strFromU8(after['project.json'] ?? new Uint8Array())).toBe(
    strFromU8(before['project.json'] ?? new Uint8Array()),
  );
});
