import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRateLimiter } from '../src/shared/rateLimit';

test('blocks the next call after the limit inside the window', () => {
  let now = 1_000;
  const limiter = createRateLimiter(2, 10_000, () => now);
  assert.equal(limiter.allow('1.2.3.4'), true);
  assert.equal(limiter.allow('1.2.3.4'), true);
  assert.equal(limiter.allow('1.2.3.4'), false);
  assert.equal(limiter.allow('5.6.7.8'), true);
  now += 10_001;
  assert.equal(limiter.allow('1.2.3.4'), true);
});
