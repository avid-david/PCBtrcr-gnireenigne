/**
 * Upgrades of `project.json` between schema versions. `MIGRATIONS[i]` turns a version `i + 1`
 * document into version `i + 2`. Version 1 is the first released format, so the list is empty;
 * the next format change adds a function here and a fixture test for the old version.
 */
export type Migration = (doc: unknown) => unknown;

export const MIGRATIONS: readonly Migration[] = [];

/** Applies every migration from `fromVersion` up to the current version. */
export function migrate(
  doc: unknown,
  fromVersion: number,
  migrations: readonly Migration[] = MIGRATIONS,
): unknown {
  return migrations.slice(fromVersion - 1).reduce((d, m) => m(d), doc);
}
