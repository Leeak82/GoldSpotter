import assert from 'node:assert/strict';
import { test } from 'node:test';
import { HttpError } from '../src/shared/errors';
import { interpretWithRetry } from '../src/shared/interpret';

const good = JSON.stringify({
  board_type: 'Motherboard',
  grade: 'B',
  verdict: 'Worth sorting the fingers and the slot connectors.',
  recovery_tips: ['Bag the connectors separately.'],
  components: [
    {
      label: 'PCIe fingers',
      type: 'gold_fingers',
      bbox: [0, 0.8, 0.4, 0.15],
      precious_metals: ['gold'],
      gold_level: 'medium',
      confidence: 0.7,
      note: 'Edge contacts on the left.',
    },
  ],
});

test('retries once when the first reply is not JSON', async () => {
  const calls: number[] = [];
  const value = await interpretWithRetry(async (attempt) => {
    calls.push(attempt);
    if (attempt === 0) return 'I see a board, not json';
    return good;
  });
  assert.deepEqual(calls, [0, 1]);
  assert.equal(value.grade, 'B');
  assert.equal(value.components.length, 1);
});

test('does not call the model a second time after a valid reply', async () => {
  let calls = 0;
  await interpretWithRetry(async () => {
    calls += 1;
    return good;
  });
  assert.equal(calls, 1);
});

test('fails after two unreadable replies', async () => {
  await assert.rejects(
    () => interpretWithRetry(async () => 'nope'),
    (error: unknown) => error instanceof HttpError && error.statusCode === 502,
  );
});

test('does not retry a rejected API key', async () => {
  let calls = 0;
  await assert.rejects(
    () =>
      interpretWithRetry(async () => {
        calls += 1;
        throw new HttpError('The Gemini API key was rejected.', 401, 'not_configured');
      }),
    (error: unknown) => error instanceof HttpError && error.message.includes('API key'),
  );
  assert.equal(calls, 1);
});

test('does not retry a provider timeout', async () => {
  let calls = 0;
  await assert.rejects(
    () =>
      interpretWithRetry(async () => {
        calls += 1;
        throw new HttpError('The vision model timed out.', 504, 'timeout');
      }),
    (error: unknown) => error instanceof HttpError && error.statusCode === 504,
  );
  assert.equal(calls, 1);
});
