import { MM_PER_MIL, TO_MM, type LengthUnit } from '../core/view/units';

// Tools format lengths too, so the unit type and formatting live in core.
export { formatLength, MM_PER_MIL, type LengthUnit } from '../core/view/units';

/** Parses any finite number (e.g. an angle), accepting a decimal comma; `null` if invalid. */
export function parseNumber(text: string): number | null {
  const trimmed = text.trim().replace(',', '.');
  const value = trimmed === '' ? Number.NaN : Number(trimmed);
  return Number.isFinite(value) ? value : null;
}

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

/** A field label with its "(mm)" changed to the unit in use. */
export const unitLabel = (label: string, unit: LengthUnit): string =>
  label.replace('(mm)', `(${unit})`);
