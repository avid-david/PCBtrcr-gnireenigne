import { strFromU8, strToU8, unzipSync, zipSync, type Zippable } from 'fflate';
import { err, ok, type Result } from '../result';

/** Inside a `.pcbrt` archive: the project and the original photos (docs/adr/0006). */
export const PROJECT_ENTRY = 'project.json';

export interface ArchivePhoto {
  readonly imageId: string;
  readonly mimeType: string;
  readonly bytes: Uint8Array;
}

export interface ArchiveContents {
  readonly projectJson: string;
  readonly photos: ReadonlyMap<string, Uint8Array>;
}

export type ArchiveError = { readonly kind: 'not-a-zip' } | { readonly kind: 'no-project' };

const EXTENSIONS: Readonly<Record<string, string>> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};

/** Where a photo is stored in the archive (by image id, so names never clash). */
export const photoPath = (imageId: string, mimeType: string): string =>
  `images/${imageId}.${EXTENSIONS[mimeType] ?? 'bin'}`;

const photoId = (path: string): string | null =>
  /^images\/([^/]+)\.[a-z]+$/.exec(path)?.[1] ?? null;

/** Builds the archive. Photos are stored, not deflated: they are already compressed. */
export function writeArchive(projectJson: string, photos: readonly ArchivePhoto[]): Uint8Array {
  const entries: Zippable = { [PROJECT_ENTRY]: strToU8(projectJson) };
  for (const photo of photos) {
    entries[photoPath(photo.imageId, photo.mimeType)] = [photo.bytes, { level: 0 }];
  }
  return zipSync(entries, { level: 6 });
}

function unzip(bytes: Uint8Array): Result<Record<string, Uint8Array>, ArchiveError> {
  try {
    return ok(unzipSync(bytes));
  } catch {
    return err({ kind: 'not-a-zip' });
  }
}

/** Reads the archive; photos are returned by image id. */
export function readArchive(bytes: Uint8Array): Result<ArchiveContents, ArchiveError> {
  const files = unzip(bytes);
  if (!files.ok) {
    return files;
  }
  const project = files.value[PROJECT_ENTRY];
  if (project === undefined) {
    return err({ kind: 'no-project' });
  }
  const photos = new Map<string, Uint8Array>();
  for (const [path, data] of Object.entries(files.value)) {
    const id = photoId(path);
    if (id !== null) {
      photos.set(id, data);
    }
  }
  return ok({ projectJson: strFromU8(project), photos });
}

/** Human-readable message for an archive error. */
export const describeArchiveError = (error: ArchiveError): string =>
  error.kind === 'not-a-zip'
    ? 'This is not a PCB Reverse Tracer project file (.pcbrt).'
    : 'The project file is damaged: it has no project.json.';
