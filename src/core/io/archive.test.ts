import { strToU8, unzipSync, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import {
  describeArchiveError,
  photoPath,
  PROJECT_ENTRY,
  readArchive,
  writeArchive,
  type ArchiveError,
} from './archive';

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

  it.each<ArchiveError>([{ kind: 'not-a-zip' }, { kind: 'no-project' }])(
    'describes $kind for the user',
    (error) => {
      expect(describeArchiveError(error)).toMatch(/project/);
    },
  );
});
