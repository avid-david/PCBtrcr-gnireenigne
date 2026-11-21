import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

// Limits from CLAUDE.md ("Code quality limits"). Change them only via an ADR.
const qualityLimits = {
  complexity: ['error', 8],
  'max-depth': ['error', 3],
  'max-lines-per-function': ['error', { max: 40, skipBlankLines: true, skipComments: true }],
  'max-lines': ['error', { max: 300, skipBlankLines: true, skipComments: true }],
  'max-params': 'off',
  '@typescript-eslint/max-params': ['error', { max: 3 }],
  '@typescript-eslint/no-explicit-any': 'error',
  '@typescript-eslint/no-non-null-assertion': 'error',
  '@typescript-eslint/ban-ts-comment': [
    'error',
    { 'ts-ignore': true, 'ts-nocheck': true, 'ts-expect-error': 'allow-with-description' },
  ],
};

export default defineConfig([
  globalIgnores(['dist', 'coverage', 'playwright-report', 'test-results']),
  {
    // Inline `eslint-disable` comments are ignored and reported, so limits cannot be bypassed.
    linterOptions: { noInlineConfig: true, reportUnusedDisableDirectives: 'error' },
  },
  js.configs.recommended,
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      ...qualityLimits,
      eqeqeq: ['error', 'always'],
      'no-console': ['error', { allow: ['warn', 'error'] }],
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
  },
  {
    files: ['src/{ui,app}/**/*.tsx'],
    extends: [reactHooks.configs.flat['recommended-latest'], reactRefresh.configs.vite],
  },
  {
    files: ['scripts/**', 'e2e/**', '*.config.{ts,js}'],
    languageOptions: { globals: globals.node },
    rules: { 'no-console': 'off' },
  },
  {
    // Test suites are long lists of small cases; the per-function limit would only
    // force arbitrary splitting of `describe` blocks (see docs/adr/0001-stack.md).
    files: ['**/*.test.{ts,tsx}', '**/*.test-support.ts', 'e2e/**'],
    rules: { 'max-lines-per-function': 'off' },
  },
  {
    files: ['**/*.{js,cjs,mjs}'],
    extends: [tseslint.configs.disableTypeChecked],
  },
  {
    files: ['**/*.cjs'],
    languageOptions: { sourceType: 'commonjs', globals: globals.node },
  },
  prettier,
]);
