import type { ToolSettings } from './settings';

export type ViaSize = ToolSettings['via'];

/** Pad diameters a drawn or resized via can have (SPEC F7). */
export const VIA_PAD_MIN_MM = 0.1;
export const VIA_PAD_MAX_MM = 10;

/** Drills are whole hundredths of a mm: at least 0.01 mm and always smaller than the pad. */
const HUNDREDTHS = 100;
const EPSILON = 1e-9;

const clamp = (v: number, min: number, max: number): number => Math.min(max, Math.max(min, v));

/** A drawn or resized diameter, clamped to the via pad range (also used for holes and points). */
export const clampDiameter = (mm: number): number => clamp(mm, VIA_PAD_MIN_MM, VIA_PAD_MAX_MM);

/** The largest whole number of hundredths strictly below the pad (0.1 → 9, 0.123 → 12). */
const maxDrillHundredths = (padMm: number): number => Math.ceil(padMm * HUNDREDTHS - EPSILON) - 1;

/**
 * The size of a via drawn by dragging `radiusMm` from its centre: the pad is twice the radius
 * (clamped, not snapped) and the drill keeps the defaults' drill-to-pad ratio, rounded to 0.01 mm.
 */
export function drawnViaSize(defaults: ViaSize, radiusMm: number): ViaSize {
  const padMm = clampDiameter(2 * radiusMm);
  const ratio = defaults.drillMm / defaults.padMm;
  const hundredths = clamp(Math.round(padMm * ratio * HUNDREDTHS), 1, maxDrillHundredths(padMm));
  return { padMm, drillMm: hundredths / HUNDREDTHS };
}
