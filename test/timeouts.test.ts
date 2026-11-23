import assert from 'node:assert/strict';
import { test } from 'node:test';
import { workingCopy } from '../src/client/lib/working';
import { callTimeoutMs, FULL_CALL_TIMEOUT_MS, LITE_CALL_TIMEOUT_MS, OVERALL_TIMEOUT_MS } from '../src/server/analyze';

test('the full model gets 40 seconds and a lite fallback still fits in the overall cap', () => {
  const now = 1_000_000;
  const deadline = now + OVERALL_TIMEOUT_MS;
  assert.equal(callTimeoutMs('gemini-3.6-flash', deadline, true, now), FULL_CALL_TIMEOUT_MS);
  assert.equal(FULL_CALL_TIMEOUT_MS, 40_000);
  assert.equal(callTimeoutMs('gemini-3.5-flash-lite', deadline, false, now), LITE_CALL_TIMEOUT_MS);
  // Full call, a busy retry and a lite read all fit.
  assert.ok(FULL_CALL_TIMEOUT_MS * 2 + LITE_CALL_TIMEOUT_MS / 2 <= OVERALL_TIMEOUT_MS);
});

test('late in the budget the full model leaves room for the lite fallback', () => {
  const now = 1_000_000;
  const deadline = now + 30_000;
  assert.equal(callTimeoutMs('gemini-3.6-flash', deadline, true, now), 15_000);
  assert.equal(callTimeoutMs('gemini-3.6-flash', deadline, false, now), 30_000);
});

test('a long wait says it is still scanning', () => {
  assert.equal(workingCopy(3).eyebrow, 'Reading the board');
  assert.match(workingCopy(20).eyebrow, /Still scanning · 20s/);
  assert.match(workingCopy(50).title, /minute and a half/);
  assert.equal(workingCopy(50, 'AI is busy, retrying…').eyebrow, 'AI is busy, retrying…');
});
