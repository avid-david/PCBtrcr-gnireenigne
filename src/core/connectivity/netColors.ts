import type { NetId } from './nets';

/** FNV-1a: a small, stable string hash (same input → same colour on every run and machine). */
function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

/** HSL (0–1 each) to 0xRRGGBB. */
function hslToRgb(h: number, s: number, l: number): number {
  const channel = (n: number) => {
    const k = (n + h * 12) % 12;
    const a = s * Math.min(l, 1 - l);
    return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
  };
  return (channel(0) << 16) | (channel(8) << 8) | channel(4);
}

const GOLDEN_RATIO = 0.618033988749895;

/**
 * Colour of a net, keyed by its stable id (SPEC: "one net = one colour", no shuffling when
 * unrelated features change). Hues are spread by the golden ratio; saturation and lightness
 * are fixed so every net reads well on the dark background and over photos.
 */
export function netColor(id: NetId): number {
  const hue = (hash(id) * GOLDEN_RATIO) % 1;
  return hslToRgb(hue, 0.85, 0.6);
}
