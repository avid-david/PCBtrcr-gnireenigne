import type { Project } from '../model/project';
import { err, ok, type Result } from '../result';
import { migrate } from './migrations';
import { brokenReference } from './references';
import { documentV2 } from './schemaV2';

/** The schema version this build writes, and the newest it can read. */
export const CURRENT_SCHEMA_VERSION = 2;

export type LoadError =
  | { readonly kind: 'invalid-json' }
  | { readonly kind: 'not-a-project' }
  | { readonly kind: 'future-version'; readonly found: number }
  | { readonly kind: 'invalid'; readonly path: string; readonly message: string }
  | { readonly kind: 'broken-reference'; readonly message: string };

/** `project.json` for a project: plain data with the schema version on top. */
export function serializeProject(project: Project): string {
  return JSON.stringify({ schemaVersion: CURRENT_SCHEMA_VERSION, project }, null, 2);
}

function parseJson(text: string): Result<unknown, LoadError> {
  try {
    return ok(JSON.parse(text) as unknown);
  } catch {
    return err({ kind: 'invalid-json' });
  }
}

function versionOf(doc: unknown): Result<number, LoadError> {
  const version =
    typeof doc === 'object' && doc !== null
      ? (doc as { schemaVersion?: unknown }).schemaVersion
      : undefined;
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    return err({ kind: 'not-a-project' });
  }
  return version > CURRENT_SCHEMA_VERSION
    ? err({ kind: 'future-version', found: version })
    : ok(version);
}

function validate(doc: unknown): Result<Project, LoadError> {
  const parsed = documentV2.safeParse(doc);
  if (parsed.success) {
    return ok(parsed.data.project);
  }
  const issue = parsed.error.issues[0];
  return err({
    kind: 'invalid',
    path: issue?.path.map(String).join('.') ?? '',
    message: issue?.message ?? 'invalid project',
  });
}

function checkReferences(project: Project): Result<Project, LoadError> {
  const message = brokenReference(project);
  return message === null ? ok(project) : err({ kind: 'broken-reference', message });
}

/** Reads `project.json`: any supported version is migrated to the current one and validated. */
export function parseProject(text: string): Result<Project, LoadError> {
  const json = parseJson(text);
  if (!json.ok) {
    return json;
  }
  const version = versionOf(json.value);
  if (!version.ok) {
    return version;
  }
  const current = validate(migrate(json.value, version.value));
  return current.ok ? checkReferences(current.value) : current;
}

const messages: {
  readonly [K in LoadError['kind']]: (e: Extract<LoadError, { kind: K }>) => string;
} = {
  'invalid-json': () => 'The file is damaged: project.json is not valid JSON.',
  'not-a-project': () => 'This is not a PCB Reverse Tracer project.',
  'future-version': (e) =>
    `This project was saved by a newer version of PCB Reverse Tracer (format ${String(e.found)}); this version reads up to format ${String(CURRENT_SCHEMA_VERSION)}. Please update the app.`,
  invalid: (e) => `The project file is damaged at "${e.path}": ${e.message}.`,
  'broken-reference': (e) => `The project file is damaged: ${e.message}.`,
};

/** Human-readable message for a load error. */
export const describeLoadError = (error: LoadError): string =>
  (messages[error.kind] as (e: LoadError) => string)(error);
