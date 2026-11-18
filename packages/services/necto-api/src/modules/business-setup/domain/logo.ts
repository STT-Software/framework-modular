import { createHash } from 'node:crypto';
import { InvalidLogoError } from './errors';

export const LOGO_MAX_BYTES = 1_048_576; // 1 MB
export const LOGO_CONTENT_TYPES = ['image/png', 'image/jpeg'] as const;
export type LogoContentType = (typeof LOGO_CONTENT_TYPES)[number];

/** What is known about the logo without its bytes (they are large and only needed to serve the image). */
export interface LogoInfo {
  contentType: LogoContentType;
  sizeBytes: number;
  sha256: string;
  updatedAt: Date;
}

export interface LogoFile {
  info: LogoInfo;
  bytes: Uint8Array;
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG_SIGNATURE = [0xff, 0xd8, 0xff];

function startsWith(bytes: Uint8Array, signature: number[]): boolean {
  return bytes.length >= signature.length && signature.every((byte, index) => bytes[index] === byte);
}

/**
 * Checks a logo upload and builds its record. The type is decided from the bytes themselves (the file signature), never from
 * the name or the type the browser declared: a text, an SVG (which can carry scripts) or an executable renamed to .png is
 * refused. The declared type is only compared as a courtesy so the message can say what went wrong.
 *
 * @throws InvalidLogoError
 */
export function inspectLogo(bytes: Uint8Array, declaredType: string | undefined, now: Date): LogoFile {
  if (bytes.length === 0) throw new InvalidLogoError('The logo file is empty');
  if (bytes.length > LOGO_MAX_BYTES) throw new InvalidLogoError('The logo must be a PNG or JPG of at most 1 MB');
  const contentType: LogoContentType | null = startsWith(bytes, PNG_SIGNATURE) ? 'image/png' : startsWith(bytes, JPEG_SIGNATURE) ? 'image/jpeg' : null;
  if (!contentType) throw new InvalidLogoError('The logo must be a PNG or JPG image');
  if (declaredType && declaredType !== contentType) throw new InvalidLogoError('The file content does not match its declared type');
  return {
    info: { contentType, sizeBytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'), updatedAt: now },
    bytes,
  };
}
