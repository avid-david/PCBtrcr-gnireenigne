import fc from 'fast-check';

// Property tests are deterministic (CLAUDE.md): a fixed seed, overridable to explore more
// cases locally, e.g. `FC_SEED=123 pnpm test`. A failure prints the seed and path to replay.
const seed = Number(process.env.FC_SEED ?? 20261121);

fc.configureGlobal({ seed, numRuns: 200 });
