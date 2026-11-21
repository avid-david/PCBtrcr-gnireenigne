/** Parses any finite number (e.g. an angle), accepting a decimal comma; `null` if invalid. */
export function parseNumber(text: string): number | null {
  const trimmed = text.trim().replace(',', '.');
  const value = trimmed === '' ? Number.NaN : Number(trimmed);
  return Number.isFinite(value) ? value : null;
}

/** Unit lengths are shown and typed in (SPEC: mm or mil); the model always stores mm. */
export type LengthUnit = 'mm' | 'mil';

export const MM_PER_MIL = 0.0254;

const TO_MM: Readonly<Record<LengthUnit, number>> = { mm: 1, mil: MM_PER_MIL };

/**
 * Parses a positive length in the given unit, or in the unit typed after it ("10mil", "0.25 mm",
 * "8 th"); returns mm, or `null` if invalid. A decimal comma is accepted.
 */
export function parseLength(text: string, unit: LengthUnit): number | null {
  const match = /^\s*([0-9]*[.,]?[0-9]+)\s*(mm|mil|th|thou)?\s*$/i.exec(text);
  if (match === null) {
    return null;
  }
  const typed = match[2]?.toLowerCase();
  const factor = typed === undefined ? TO_MM[unit] : typed === 'mm' ? 1 : MM_PER_MIL;
  const value = Number((match[1] ?? '').replace(',', '.')) * factor;
  return value > 0 ? value : null;
}

/** A length in mm shown in the unit, without floating-point noise (0.254 mm → "10" mil). */
export function formatLength(mm: number, unit: LengthUnit): string {
  const value = mm / TO_MM[unit];
  const places = unit === 'mm' ? 1e4 : 1e2;
  return String(Math.round(value * places) / places);
}

/** A field label with its "(mm)" changed to the unit in use. */
export const unitLabel = (label: string, unit: LengthUnit): string =>
  label.replace('(mm)', `(${unit})`);
