/**
 * Layer boundaries from CLAUDE.md ("Architecture: layered, dependencies point inward").
 * @type {import('dependency-cruiser').IConfiguration}
 */
const TESTS = String.raw`\.test\.tsx?$`;

module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      severity: 'error',
      comment: 'Circular imports hide layering mistakes and break tree-shaking.',
      from: {},
      to: { circular: true },
    },
    {
      name: 'core-is-self-contained',
      severity: 'error',
      comment: 'core is pure domain logic and imports nothing from other src/ folders.',
      from: { path: '^src/core/' },
      to: { path: '^src/', pathNot: '^src/core/' },
    },
    {
      name: 'core-no-ui-or-render-libraries',
      severity: 'error',
      comment: 'core must stay free of React, PixiJS and UI state libraries.',
      from: { path: '^src/core/' },
      to: { path: String.raw`node_modules/(react|react-dom|pixi\.js|@pixi|zustand)/` },
    },
    {
      name: 'tools-only-use-core',
      severity: 'error',
      comment: 'tools may import core only.',
      from: { path: '^src/tools/' },
      to: { path: '^src/', pathNot: '^src/(core|tools)/' },
    },
    {
      name: 'render-and-ui-use-core-and-tools',
      severity: 'error',
      comment: 'render and ui may import core and tools (and themselves), never platform or app.',
      from: { path: '^src/(render|ui)/' },
      to: { path: '^src/(platform|app)/' },
    },
    {
      name: 'platform-only-uses-core',
      severity: 'error',
      comment: 'platform adapters may depend on core types only.',
      from: { path: '^src/platform/' },
      to: { path: '^src/', pathNot: '^src/(core|platform)/' },
    },
    {
      name: 'nothing-imports-app',
      severity: 'error',
      comment: 'app is the composition root; only it knows about everything.',
      from: { path: '^src/', pathNot: '^src/app/' },
      to: { path: '^src/app/' },
    },
    {
      name: 'no-dev-deps-in-production-code',
      severity: 'error',
      comment: 'Production code must not import devDependencies.',
      from: { path: '^src/', pathNot: TESTS },
      to: { dependencyTypes: ['npm-dev'] },
    },
    {
      name: 'not-to-unresolvable',
      severity: 'error',
      from: {},
      to: { couldNotResolve: true },
    },
    {
      name: 'no-non-package-json',
      severity: 'error',
      comment: 'Every imported package must be declared in package.json.',
      from: {},
      to: { dependencyTypes: ['npm-no-pkg', 'npm-unknown'] },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.app.json' },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default', 'types'],
      extensions: ['.ts', '.tsx', '.js', '.mjs', '.cjs', '.json', '.d.ts'],
    },
    reporterOptions: { text: { highlightFocused: true } },
  },
};
