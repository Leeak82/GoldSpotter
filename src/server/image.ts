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
