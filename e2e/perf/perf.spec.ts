import { expect, test, type Page } from '@playwright/test';
import { strToU8, zipSync } from 'fflate';
import { makePng } from '../support/png';

// Performance check for the SPEC target (≥ 50 fps pan/zoom with 2 × 24 MP photos and 5000
// features). Not part of `pnpm test:e2e`; run with `pnpm perf`, in a real (headed, GPU) browser.

const WIDTH = 6000;
const HEIGHT = 4000;
const FEATURES = 5000;

/** A 24 MP photo with a coarse checker pattern (cheap to encode, real to upload and draw). */
const photo = (shade: number) =>
  makePng(WIDTH, HEIGHT, (x, y) =>
    ((x >> 7) + (y >> 7)) % 2 === 0 ? [shade, 90, 40] : [40, shade, 90],
  );

/** 2500 vias, each with a short trace tied to it, alternating between the layers. */
function features(): unknown[] {
  return Array.from({ length: FEATURES / 2 }, (_, i) => {
    const at = { x: 5 + (i % 50) * 3, y: 5 + Math.floor(i / 50) * 2 };
    const id = String(i);
    return [
      { kind: 'via', id: `v${id}`, at, drillMm: 0.3, padMm: 0.6 },
      {
        kind: 'trace',
        id: `t${id}`,
        layerId: i % 2 === 0 ? 'top' : 'bottom',
        widthMm: 0.25,
        vertices: [
          { id: `t${id}a`, kind: 'bound', anchor: `v${id}` },
          { id: `t${id}b`, kind: 'free', at: { x: at.x + 1.5, y: at.y + 1 } },
        ],
      },
    ];
  }).flat();
}

const layer = (id: 'top' | 'bottom', name: string) => ({
  id,
  name,
  side: id,
  image: {
    id: `img-${id}`,
    fileName: `${id}.png`,
    mimeType: 'image/png',
    widthPx: WIDTH,
    heightPx: HEIGHT,
  },
  mirrored: id === 'bottom',
  corners: {},
});

/** A `.pcbrt` file with both photos and all the features. */
function projectFile(): Uint8Array {
  const project = {
    board: { widthMm: 160, heightMm: 105 },
    layers: [layer('top', 'Top'), layer('bottom', 'Bottom')],
    matches: [],
    features: features(),
    netStyles: [],
  };
  return zipSync({
    'project.json': strToU8(JSON.stringify({ schemaVersion: 3, project })),
    'images/img-top.png': [photo(200), { level: 0 }],
    'images/img-bottom.png': [photo(120), { level: 0 }],
  });
}

/** The GPU the browser renders with, as WebGL reports it. */
const gpuName = (page: Page) =>
  page.evaluate(() => {
    const gl = document.createElement('canvas').getContext('webgl');
    const info = gl?.getExtension('WEBGL_debug_renderer_info');
    return gl === null || info === null || info === undefined
      ? 'unknown'
      : String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL));
  });

/** Starts recording animation-frame times in the page. */
const recordFrames = (page: Page) =>
  page.evaluate(() => {
    const w = window as unknown as { frames: number[] };
    w.frames = [];
    const tick = (t: number) => {
      w.frames.push(t);
      if (w.frames.length < 2000) {
        requestAnimationFrame(tick);
      }
    };
    requestAnimationFrame(tick);
  });

/** Centre of the board view on the page. */
async function boardCentre(page: Page) {
  const box = await page.getByTestId('board-host').boundingBox();
  if (box === null) {
    throw new Error('the board view is not visible');
  }
  return { cx: box.x + box.width / 2, cy: box.y + box.height / 2 };
}

/** Pans with the middle button for a few seconds; returns frame-to-frame times, sorted (ms). */
async function panFrameGaps(page: Page): Promise<number[]> {
  const { cx, cy } = await boardCentre(page);
  await page.mouse.move(cx, cy);
  await page.mouse.wheel(0, -300);
  await recordFrames(page);
  await page.mouse.down({ button: 'middle' });
  for (let i = 0; i < 180; i++) {
    await page.mouse.move(cx + Math.sin(i / 15) * 250, cy + Math.cos(i / 20) * 150);
  }
  await page.mouse.up({ button: 'middle' });
  const frames = await page.evaluate(() => (window as unknown as { frames: number[] }).frames);
  return frames
    .slice(1)
    .map((t, i) => t - (frames[i] ?? t))
    .sort((x, y) => x - y);
}

test('pans at the SPEC frame rate with two 24 MP photos and 5000 features', async ({ page }) => {
  test.setTimeout(240_000);
  await page.goto('/');
  await page.getByLabel('Open project file').setInputFiles({
    name: 'perf.pcbrt',
    mimeType: 'application/zip',
    buffer: Buffer.from(projectFile()),
  });
  await expect(page.getByRole('status', { name: 'Notice' })).toHaveText('Opened perf', {
    timeout: 120_000,
  });
  const gpu = await gpuName(page);
  const gaps = await panFrameGaps(page);
  const median = gaps[Math.floor(gaps.length / 2)] ?? 0;
  const p95 = gaps[Math.floor(gaps.length * 0.95)] ?? 0;
  const fps = 1000 / median;
  console.log(`GPU: ${gpu}`);
  console.log(
    `frames: ${String(gaps.length)}, median ${median.toFixed(1)} ms (${fps.toFixed(0)} fps), p95 ${p95.toFixed(1)} ms`,
  );
  expect(fps).toBeGreaterThanOrEqual(50);
});
