import { HttpError } from '../shared/errors';

export const MAX_IMAGE_BYTES = 6 * 1024 * 1024;
const MIN_IMAGE_BYTES = 64;

const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp']);

export type PreparedImage = {
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
  base64: string;
  buffer: Buffer;
};

export function decodeImagePayload(body: unknown): PreparedImage {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new HttpError('Send a JSON body with an image.', 400, 'bad_image');
  }
  const record = body as Record<string, unknown>;
  const mimeType = typeof record.mimeType === 'string' ? record.mimeType.toLowerCase().split(';')[0].trim() : '';
  if (!ALLOWED.has(mimeType)) {
    throw new HttpError('Use a JPEG, PNG, or WebP photo.', 400, 'bad_image');
  }
  if (typeof record.image !== 'string' || record.image.trim().length === 0) {
    throw new HttpError('The photo data was empty.', 400, 'bad_image');
  }
  const base64 = record.image.replace(/^data:[^,]+,/, '').replace(/\s/g, '');
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) {
    throw new HttpError('The photo was not valid base64.', 400, 'bad_image');
  }
  const buffer = Buffer.from(base64, 'base64');
  if (buffer.length < MIN_IMAGE_BYTES) {
    throw new HttpError('That photo is too small to read.', 400, 'bad_image');
  }
  if (buffer.length > MAX_IMAGE_BYTES) {
    throw new HttpError('That photo is too large. It should be compressed before upload.', 413, 'image_too_large');
  }
  assertMagic(buffer, mimeType);
  return { mimeType: mimeType as PreparedImage['mimeType'], base64, buffer };
}

function assertMagic(buffer: Buffer, mimeType: string): void {
  const jpeg = buffer[0] === 0xff && buffer[1] === 0xd8;
  const png = buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const webp = buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP';
  const ok = (mimeType === 'image/jpeg' && jpeg) || (mimeType === 'image/png' && png) || (mimeType === 'image/webp' && webp);
  if (!ok) throw new HttpError('That file does not match the image type sent with it.', 400, 'bad_image');
}

/** Reads pixel width and height from a JPEG, PNG or WebP header. Null when the header is not understood. */
export function imageSize(buffer: Buffer): { width: number; height: number } | null {
  if (buffer.length >= 24 && buffer[0] === 0x89 && buffer[1] === 0x50) {
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  }
  if (buffer.length >= 30 && buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP') {
    const chunk = buffer.subarray(12, 16).toString('ascii');
    if (chunk === 'VP8X') return { width: 1 + buffer.readUIntLE(24, 3), height: 1 + buffer.readUIntLE(27, 3) };
    if (chunk === 'VP8 ') return { width: buffer.readUInt16LE(26) & 0x3fff, height: buffer.readUInt16LE(28) & 0x3fff };
    if (chunk === 'VP8L') {
      const bits = buffer.readUInt32LE(21);
      return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
    }
    return null;
  }
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = buffer[offset + 1];
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2;
      continue;
    }
    const length = buffer.readUInt16BE(offset + 2);
    const isFrame = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isFrame) return { width: buffer.readUInt16BE(offset + 7), height: buffer.readUInt16BE(offset + 5) };
    offset += 2 + length;
  }
  return null;
}
