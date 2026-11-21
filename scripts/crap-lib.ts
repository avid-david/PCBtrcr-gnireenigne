// Pure helpers for the CRAP check (CLAUDE.md: CRAP = complexity² × (1 − coverage)³ + complexity).

export interface Position {
  readonly line: number;
  readonly column: number | null;
}

export interface Span {
  readonly start: Position;
  readonly end: Position;
}

/** Subset of an Istanbul file coverage record (coverage-final.json) that the check needs. */
export interface FileCoverage {
  readonly statementMap: Readonly<Record<string, Span>>;
  readonly s: Readonly<Record<string, number>>;
  readonly fnMap: Readonly<Record<string, FunctionEntry>>;
  readonly f: Readonly<Record<string, number>>;
}

/** `decl` is the function name; `loc` starts at the body, so a long signature lies between them. */
export interface FunctionEntry {
  readonly name: string;
  readonly decl: Span;
  readonly loc: Span;
}

export interface FunctionScore {
  readonly file: string;
  readonly line: number;
  readonly name: string;
  readonly complexity: number;
  readonly coverage: number;
  readonly crap: number;
}

export const CRAP_TARGET = 15;
export const CRAP_LIMIT = 30;

/** CRAP score for a function with the given cyclomatic complexity and coverage ratio (0–1). */
export function crapScore(complexity: number, coverage: number): number {
  return complexity ** 2 * (1 - coverage) ** 3 + complexity;
}

/** Reads ESLint `complexity` messages such as "Function 'x' has a complexity of 3.". */
export function parseComplexityMessage(
  message: string,
): { name: string; complexity: number } | null {
  const match = /^(.*) has a complexity of (\d+)/.exec(message);
  if (match?.[1] === undefined || match[2] === undefined) {
    return null;
  }
  return { name: match[1], complexity: Number(match[2]) };
}

const spanLength = (span: Span): number => span.end.line - span.start.line;

const fullSpan = (fn: FunctionEntry): Span => ({ start: fn.decl.start, end: fn.loc.end });

const containsLine = (span: Span, line: number): boolean =>
  span.start.line <= line && line <= span.end.line;

/** Statement coverage ratio of the innermost function that contains `line`; 0 if none. */
export function functionCoverage(file: FileCoverage | undefined, line: number): number {
  if (file === undefined) {
    return 0;
  }
  const candidates = Object.entries(file.fnMap)
    .map(([id, fn]) => [id, fullSpan(fn)] as const)
    .filter(([, span]) => containsLine(span, line));
  const innermost = candidates.sort(([, a], [, b]) => spanLength(a) - spanLength(b))[0];
  if (innermost === undefined) {
    return 0;
  }
  const [fnId, span] = innermost;
  const statementIds = Object.entries(file.statementMap)
    .filter(([, statement]) => containsLine(span, statement.start.line))
    .map(([id]) => id);
  if (statementIds.length === 0) {
    return (file.f[fnId] ?? 0) > 0 ? 1 : 0;
  }
  const covered = statementIds.filter((id) => (file.s[id] ?? 0) > 0).length;
  return covered / statementIds.length;
}

/** Splits scores into those over the hard limit and those at or over the target. */
export function classify(scores: readonly FunctionScore[]): {
  failures: FunctionScore[];
  warnings: FunctionScore[];
} {
  return {
    failures: scores.filter((s) => s.crap > CRAP_LIMIT),
    warnings: scores.filter((s) => s.crap >= CRAP_TARGET && s.crap <= CRAP_LIMIT),
  };
}
