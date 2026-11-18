import assert from 'node:assert/strict';
import { test } from 'node:test';
import { HttpError } from '../src/shared/errors';
import { decodeImagePayload, MAX_IMAGE_BYTES } from '../src/server/image';

function jpeg(bytes = 80): string {
  const buffer = Buffer.alloc(bytes, 0);
  buffer[0] = 0xff;
  buffer[1] = 0xd8;
  buffer[2] = 0xff;
  return buffer.toString('base64');
}

test('accepts a jpeg payload and strips a data URL prefix', () => {
  const prepared = decodeImagePayload({
    mimeType: 'image/jpeg; charset=binary',
    image: `data:image/jpeg;base64,${jpeg()}`,
  });
  assert.equal(prepared.mimeType, 'image/jpeg');
  assert.ok(prepared.buffer.length >= 64);
});

test('rejects a text file pretending to be a png', () => {
  const image = Buffer.from('this is not a png, just some longer text pretending to be one!!').toString('base64');
  assert.throws(
    () => decodeImagePayload({ mimeType: 'image/png', image }),
    (error: unknown) => error instanceof HttpError && error.statusCode === 400,
  );
});

test('rejects an oversized image', () => {
  const buffer = Buffer.alloc(MAX_IMAGE_BYTES + 10, 0);
  buffer[0] = 0xff;
  buffer[1] = 0xd8;
  assert.throws(
    () => decodeImagePayload({ mimeType: 'image/jpeg', image: buffer.toString('base64') }),
    (error: unknown) => error instanceof HttpError && error.code === 'image_too_large',
  );
});

test('rejects an empty body and an unsupported type', () => {
  assert.throws(() => decodeImagePayload(null), (error: unknown) => error instanceof HttpError);
  assert.throws(
    () => decodeImagePayload({ mimeType: 'image/gif', image: jpeg() }),
    (error: unknown) => error instanceof HttpError && error.statusCode === 400,
  );
});
