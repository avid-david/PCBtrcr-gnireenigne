import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import {
  ARCHIVE_LIMITS,
  describeArchiveError,
  photoPath,
  PROJECT_ENTRY,
  readArchive,
  writeArchive,
  type ArchiveError,
} from './archive';

/**
 * Rewrites the uncompressed size an entry declares in the zip's central directory, which is what
 * the reader trusts when allocating; this fakes a huge entry without building one.
 */
function declareSize<T extends Uint8Array>(zip: T, name: string, size: number): T {
  const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  for (let at = 0; at + 46 <= zip.length; at++) {
    if (view.getUint32(at, true) !== 0x02014b50) {
      continue;
    }
    const nameLength = view.getUint16(at + 28, true);
    if (strFromU8(zip.subarray(at + 46, at + 46 + nameLength)) === name) {
      view.setUint32(at + 24, size, true);
    }
  }
  return zip;
}

const photo = (imageId: string, mimeType: string, size: number) => ({
  imageId,
  mimeType,
  bytes: Uint8Array.from({ length: size }, (_, i) => (i * 31) % 256),
});

describe('project archive', () => {
  it('returns the project and every photo byte for byte', () => {
    const photos = [photo('a', 'image/jpeg', 1000), photo('b', 'image/png', 20)];
    const result = readArchive(writeArchive('{"x":1}', photos));
    expect(result.ok && result.value.projectJson).toBe('{"x":1}');
    expect(result.ok && [...result.value.photos.entries()]).toEqual([
      ['a', photos[0]?.bytes],
      ['b', photos[1]?.bytes],
    ]);
  });

  it('stores photos under images/ by id and type', () => {
    const files = unzipSync(writeArchive('{}', [photo('img1', 'image/webp', 4)]));
    expect(Object.keys(files).sort()).toEqual(['images/img1.webp', PROJECT_ENTRY]);
    expect(photoPath('x', 'image/tiff')).toBe('images/x.bin');
  });

  it('ignores files it does not know', () => {
    const bytes = zipSync({ [PROJECT_ENTRY]: strToU8('{}'), 'notes.txt': strToU8('hi') });
    const result = readArchive(bytes);
    expect(result.ok && result.value.photos.size).toBe(0);
  });

  it('rejects bytes that are not a zip', () => {
    expect(readArchive(strToU8('hello'))).toEqual({ ok: false, error: { kind: 'not-a-zip' } });
  });

  it('rejects a zip without project.json', () => {
    const bytes = zipSync({ 'other.json': strToU8('{}') });
    expect(readArchive(bytes)).toEqual({ ok: false, error: { kind: 'no-project' } });
  });

  it('refuses entries that would unpack beyond the limits, before inflating them', () => {
    const huge = declareSize(
      zipSync({ [PROJECT_ENTRY]: strToU8('{}') }),
      PROJECT_ENTRY,
      ARCHIVE_LIMITS.projectBytes + 1,
    );
    expect(readArchive(huge)).toEqual({ ok: false, error: { kind: 'too-large' } });
    const photos = Object.fromEntries(
      ['a', 'b', 'c', 'd'].map((id) => [`images/${id}.png`, [strToU8(id), { level: 0 }] as const]),
    );
    let many = zipSync({ [PROJECT_ENTRY]: strToU8('{}'), ...photos });
    for (const id of ['a', 'b', 'c', 'd']) {
      many = declareSize(many, `images/${id}.png`, ARCHIVE_LIMITS.photoBytes);
    }
    expect(readArchive(many)).toEqual({ ok: false, error: { kind: 'too-large' } });
  });

  it('does not unpack unknown entries, however large they claim to be', () => {
    const zip = zipSync({ [PROJECT_ENTRY]: strToU8('{}'), 'big.bin': strToU8('x') });
    const result = readArchive(declareSize(zip, 'big.bin', 2 ** 31));
    expect(result.ok && result.value.projectJson).toBe('{}');
  });

  it.each<ArchiveError>([{ kind: 'not-a-zip' }, { kind: 'no-project' }, { kind: 'too-large' }])(
    'describes $kind for the user',
    (error) => {
      expect(describeArchiveError(error)).toMatch(/project/);
    },
  );
});
