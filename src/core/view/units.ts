/** Unit lengths are shown and typed in (SPEC: mm or mil); the model always stores mm. */
export type LengthUnit = 'mm' | 'mil';

export const MM_PER_MIL = 0.0254;

/** Millimetres per unit. */
export const TO_MM: Readonly<Record<LengthUnit, number>> = { mm: 1, mil: MM_PER_MIL };

/** A length in mm shown in the unit, without floating-point noise (0.254 mm → "10" mil). */
export function formatLength(mm: number, unit: LengthUnit): string {
  const value = mm / TO_MM[unit];
  const places = unit === 'mm' ? 1e4 : 1e2;
  return String(Math.round(value * places) / places);
}
