import { describe, expect, it } from 'vitest';
import { MAX_IMAGE_PIXELS, checkImageSize, checkImageType, describeImageLoadError } from './image';

describe('image checks', () => {
  it('accepts PNG, JPEG and WebP only', () => {
    expect(checkImageType('image/png').ok).toBe(true);
    expect(checkImageType('image/jpeg').ok).toBe(true);
    expect(checkImageType('image/webp').ok).toBe(true);
    expect(checkImageType('image/gif')).toEqual({
      ok: false,
      error: { kind: 'unsupported-type', mimeType: 'image/gif' },
    });
  });

  it('accepts 24 MP and refuses photos above the limit', () => {
    expect(checkImageSize(6000, 4000).ok).toBe(true);
    expect(checkImageSize(MAX_IMAGE_PIXELS + 1, 1)).toEqual({
      ok: false,
      error: { kind: 'too-large', pixels: MAX_IMAGE_PIXELS + 1 },
    });
  });

  it('describes every error kind', () => {
    expect(describeImageLoadError({ kind: 'unsupported-type', mimeType: '' })).toContain(
      '"unknown"',
    );
    expect(describeImageLoadError({ kind: 'unsupported-type', mimeType: 'image/gif' })).toContain(
      'PNG, JPEG or WebP',
    );
    expect(describeImageLoadError({ kind: 'too-large', pixels: 150e6 })).toBe(
      'Photo has 150 MP; the limit is 100 MP.',
    );
    expect(describeImageLoadError({ kind: 'decode-failed', reason: 'broken' })).toBe(
      'Could not read the photo: broken',
    );
  });
});
