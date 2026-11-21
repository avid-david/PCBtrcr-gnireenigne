// CRAP check: combines ESLint's per-function complexity with Vitest's coverage-final.json.
// Run after `pnpm test --coverage`. Fails when any function exceeds the hard limit.
import { existsSync, readFileSync } from 'node:fs';
import { relative, sep } from 'node:path';
import { ESLint } from 'eslint';
import {
  CRAP_LIMIT,
  CRAP_TARGET,
  classify,
  crapScore,
  functionCoverage,
  parseComplexityMessage,
  type FileCoverage,
  type FunctionScore,
} from './crap-lib.ts';

const COVERAGE_FILE = 'coverage/coverage-final.json';

interface ComplexityEntry {
  readonly file: string;
  readonly line: number;
  readonly message: string;
}

const toKey = (absolutePath: string): string =>
  relative(process.cwd(), absolutePath).split(sep).join('/');

function loadCoverage(): Map<string, FileCoverage> {
  if (!existsSync(COVERAGE_FILE)) {
    console.error(`${COVERAGE_FILE} not found. Run "pnpm test --coverage" first.`);
    process.exit(1);
  }
  const raw = JSON.parse(readFileSync(COVERAGE_FILE, 'utf8')) as Record<string, FileCoverage>;
  return new Map(Object.entries(raw).map(([path, data]) => [toKey(path), data]));
}

async function measureComplexity(): Promise<ComplexityEntry[]> {
  // Max 0 makes the rule report every function together with its complexity.
  const eslint = new ESLint({
    overrideConfig: { rules: { complexity: ['warn', 0] } },
    ruleFilter: ({ ruleId }) => ruleId === 'complexity',
    ignorePatterns: ['**/*.test.ts', '**/*.test.tsx', '**/*.test-support.ts'],
  });
  const results = await eslint.lintFiles(['src/**/*.{ts,tsx}']);
  return results.flatMap((result) =>
    result.messages.map((m) => ({
      file: toKey(result.filePath),
      line: m.line,
      message: m.message,
    })),
  );
}

function score(coverage: Map<string, FileCoverage>, entry: ComplexityEntry): FunctionScore[] {
  const parsed = parseComplexityMessage(entry.message);
  if (parsed === null) {
    return [];
  }
  const ratio = functionCoverage(coverage.get(entry.file), entry.line);
  const crap = crapScore(parsed.complexity, ratio);
  return [{ file: entry.file, line: entry.line, ...parsed, coverage: ratio, crap }];
}

const format = (s: FunctionScore): string =>
  [
    s.crap.toFixed(1).padStart(6),
    `cc=${String(s.complexity).padStart(2)}`,
    `cov=${(s.coverage * 100).toFixed(0).padStart(3)}%`,
    `${s.file}:${String(s.line)}`,
    s.name,
  ].join('  ');

async function main(): Promise<void> {
  const coverage = loadCoverage();
  const scores = (await measureComplexity())
    .flatMap((entry) => score(coverage, entry))
    .sort((a, b) => b.crap - a.crap);
  const { failures, warnings } = classify(scores);
  console.log(
    `CRAP check: ${String(scores.length)} functions (target < ${String(CRAP_TARGET)}, limit ${String(CRAP_LIMIT)})`,
  );
  console.log('Highest scores:');
  scores.slice(0, 5).forEach((s) => {
    console.log(`  ${format(s)}`);
  });
  warnings.forEach((s) => {
    console.warn(`warning: above target  ${format(s)}`);
  });
  failures.forEach((s) => {
    console.error(`error: above limit  ${format(s)}`);
  });
  if (failures.length > 0) {
    process.exit(1);
  }
  console.log('CRAP check passed.');
}

await main();
