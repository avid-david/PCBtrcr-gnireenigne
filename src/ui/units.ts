/** Parses a positive length in mm typed by the user, accepting a decimal comma; `null` if invalid. */
export function parseMillimetres(text: string): number | null {
  const trimmed = text.trim().replace(',', '.');
  const value = trimmed === '' ? Number.NaN : Number(trimmed);
  return Number.isFinite(value) && value > 0 ? value : null;
}

/** Parses any finite number (e.g. an angle), accepting a decimal comma; `null` if invalid. */
export function parseNumber(text: string): number | null {
  const trimmed = text.trim().replace(',', '.');
  const value = trimmed === '' ? Number.NaN : Number(trimmed);
  return Number.isFinite(value) ? value : null;
}
