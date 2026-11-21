import { strFromU8, strToU8, unzipSync, zipSync, type UnzipFileInfo, type Zippable } from 'fflate';
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

export type ArchiveError =
  { readonly kind: 'not-a-zip' } | { readonly kind: 'no-project' } | { readonly kind: 'too-large' };

/**
 * Unpacking limits. A zip entry is inflated into a buffer of its declared size, so checking the
 * declared sizes before inflating keeps a crafted file (zip bomb) from exhausting memory.
 */
export const ARCHIVE_LIMITS = {
  projectBytes: 64 * 2 ** 20,
  photoBytes: 256 * 2 ** 20,
  totalBytes: 768 * 2 ** 20,
} as const;

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

const entryLimit = (name: string): number | null => {
  if (name === PROJECT_ENTRY) {
    return ARCHIVE_LIMITS.projectBytes;
  }
  return photoId(name) === null ? null : ARCHIVE_LIMITS.photoBytes;
};

/** Accepts only known entries within the limits; remembers whether any limit was exceeded. */
function sizeGuard() {
  const guard = { total: 0, exceeded: false };
  const accept = ({ name, originalSize }: UnzipFileInfo): boolean => {
    const limit = entryLimit(name);
    if (limit === null || guard.exceeded) {
      return false;
    }
    guard.total += originalSize;
    guard.exceeded = originalSize > limit || guard.total > ARCHIVE_LIMITS.totalBytes;
    return !guard.exceeded;
  };
  return { guard, accept };
}

function unzip(bytes: Uint8Array): Result<Record<string, Uint8Array>, ArchiveError> {
  const { guard, accept } = sizeGuard();
  try {
    const files = unzipSync(bytes, { filter: accept });
    return guard.exceeded ? err({ kind: 'too-large' }) : ok(files);
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

const archiveMessages: Readonly<Record<ArchiveError['kind'], string>> = {
  'not-a-zip': 'This is not a PCB Reverse Tracer project file (.pcbrt).',
  'no-project': 'The project file is damaged: it has no project.json.',
  'too-large':
    'The project file is too large to open safely: it unpacks to more than the allowed size.',
};

/** Human-readable message for an archive error. */
export const describeArchiveError = (error: ArchiveError): string => archiveMessages[error.kind];
