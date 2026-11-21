import { describe, expect, it } from 'vitest';
import {
  classify,
  crapScore,
  functionCoverage,
  parseComplexityMessage,
  type FileCoverage,
  type FunctionScore,
} from './crap-lib.ts';

const span = (startLine: number, endLine: number) => ({
  start: { line: startLine, column: 0 },
  end: { line: endLine, column: 0 },
});

// Outer function declared on line 1 with its body on lines 2–10; inner function on lines 3–5.
const file: FileCoverage = {
  fnMap: {
    '0': { name: 'outer', decl: span(1, 1), loc: span(2, 10) },
    '1': { name: 'inner', decl: span(3, 3), loc: span(3, 5) },
  },
  f: { '0': 1, '1': 0 },
  statementMap: { '0': span(2, 2), '1': span(4, 4), '2': span(8, 8) },
  s: { '0': 1, '1': 0, '2': 1 },
};

const fakeScore = (crap: number): FunctionScore => ({
  file: 'f.ts',
  line: 1,
  name: 'f',
  complexity: 1,
  coverage: 0,
  crap,
});

describe('crapScore', () => {
  it('equals complexity when fully covered', () => {
    expect(crapScore(8, 1)).toBe(8);
  });

  it('is complexity squared plus complexity when uncovered', () => {
    expect(crapScore(5, 0)).toBe(30);
  });
});

describe('parseComplexityMessage', () => {
  it('extracts name and complexity', () => {
    const message = "Function 'foo' has a complexity of 3. Maximum allowed is 0.";
    expect(parseComplexityMessage(message)).toEqual({ name: "Function 'foo'", complexity: 3 });
  });

  it('returns null for unrelated messages', () => {
    expect(parseComplexityMessage('Unexpected any.')).toBeNull();
  });
});

describe('functionCoverage', () => {
  it('counts a multi-line signature (between decl and body) as part of the function', () => {
    expect(functionCoverage(file, 1)).toBeCloseTo(2 / 3);
  });

  it('uses the innermost function containing the line', () => {
    expect(functionCoverage(file, 3)).toBe(0);
    expect(functionCoverage(file, 1)).toBeCloseTo(2 / 3);
  });

  it('is 0 for unknown files and lines outside any function', () => {
    expect(functionCoverage(undefined, 1)).toBe(0);
    expect(functionCoverage(file, 99)).toBe(0);
  });

  it('falls back to the call count for functions without statements', () => {
    const empty: FileCoverage = {
      fnMap: { '0': { name: 'e', decl: span(1, 1), loc: span(1, 1) } },
      f: { '0': 2 },
      statementMap: {},
      s: {},
    };
    expect(functionCoverage(empty, 1)).toBe(1);
    expect(functionCoverage({ ...empty, f: { '0': 0 } }, 1)).toBe(0);
  });
});

describe('classify', () => {
  it('separates failures (above 30) from warnings (15 to 30)', () => {
    const result = classify([fakeScore(31), fakeScore(30), fakeScore(15), fakeScore(14.9)]);
    expect(result.failures.map((s) => s.crap)).toEqual([31]);
    expect(result.warnings.map((s) => s.crap)).toEqual([30, 15]);
  });
});
