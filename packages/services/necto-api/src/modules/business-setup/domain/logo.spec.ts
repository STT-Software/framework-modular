import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { InvalidLogoError } from './errors';
import { inspectLogo, LOGO_MAX_BYTES } from './logo';

const NOW = new Date('2026-03-04T15:00:00Z');
const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
const JPG = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
const withSize = (head: Uint8Array, size: number) => {
  const bytes = new Uint8Array(size);
  bytes.set(head);
  return bytes;
};

describe('logo validation', () => {
  it('accepts a PNG and a JPG and records what it is from the bytes', () => {
    assert.equal(inspectLogo(PNG, 'image/png', NOW).info.contentType, 'image/png');
    const jpg = inspectLogo(JPG, undefined, NOW);
    assert.equal(jpg.info.contentType, 'image/jpeg');
    assert.equal(jpg.info.sizeBytes, JPG.length);
    assert.match(jpg.info.sha256, /^[a-f0-9]{64}$/);
  });

  it('accepts exactly 1 MB and refuses one byte more', () => {
    assert.equal(inspectLogo(withSize(PNG, LOGO_MAX_BYTES), 'image/png', NOW).info.sizeBytes, LOGO_MAX_BYTES);
    assert.throws(() => inspectLogo(withSize(PNG, LOGO_MAX_BYTES + 1), 'image/png', NOW), InvalidLogoError);
  });

  it('refuses what is not a PNG or a JPG even if it claims to be one (SVG, text, GIF, empty)', () => {
    const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
    assert.throws(() => inspectLogo(svg, 'image/png', NOW), InvalidLogoError);
    assert.throws(() => inspectLogo(svg, 'image/svg+xml', NOW), InvalidLogoError);
    assert.throws(() => inspectLogo(new TextEncoder().encode('GIF89a....'), 'image/jpeg', NOW), InvalidLogoError);
    assert.throws(() => inspectLogo(new Uint8Array(), 'image/png', NOW), InvalidLogoError);
  });

  it('refuses a file whose declared type contradicts its content', () => {
    assert.throws(() => inspectLogo(PNG, 'image/jpeg', NOW), InvalidLogoError);
  });

  it('reports the problem under the field `logo`', () => {
    try {
      inspectLogo(new Uint8Array([1, 2, 3]), 'image/png', NOW);
      assert.fail('should have thrown');
    } catch (error) {
      assert.ok(error instanceof InvalidLogoError);
      assert.deepEqual(Object.keys(error.fields), ['logo']);
    }
  });
});
