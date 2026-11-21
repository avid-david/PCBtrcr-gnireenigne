/**
 * Upgrades of `project.json` between schema versions. `MIGRATIONS[i]` turns a version `i + 1`
 * document into version `i + 2`. Each format change adds a function here and keeps a fixture of
 * the old version that must go on loading (src/core/io/fixtures).
 */
export type Migration = (doc: unknown) => unknown;

/** Version 2 only adds feature kinds, so a version 1 document is valid as it is. */
const v1ToV2: Migration = (doc) => ({ ...(doc as object), schemaVersion: 2 });

export const MIGRATIONS: readonly Migration[] = [v1ToV2];

/** Applies every migration from `fromVersion` up to the current version. */
export function migrate(
  doc: unknown,
  fromVersion: number,
  migrations: readonly Migration[] = MIGRATIONS,
): unknown {
  return migrations.slice(fromVersion - 1).reduce((d, m) => m(d), doc);
}
