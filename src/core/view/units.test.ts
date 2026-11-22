import { describe, expect, it } from 'vitest';
import { formatLength, MM_PER_MIL } from './units';

describe('formatLength', () => {
  it('shows mm with up to four places and mil with up to two', () => {
    expect(formatLength(0.123456, 'mm')).toBe('0.1235');
    expect(formatLength(0.3, 'mil')).toBe('11.81');
    expect(formatLength(10 * MM_PER_MIL, 'mil')).toBe('10');
  });
});
