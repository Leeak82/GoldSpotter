import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SYSTEM_PROMPT, userPrompt } from '../src/server/prompt';

test('asks for the visible board parts and keeps likely wording', () => {
  assert.match(SYSTEM_PROMPT, /gold fingers/i);
  assert.match(SYSTEM_PROMPT, /MLCC/);
  assert.match(SYSTEM_PROMPT, /tantalum/i);
  assert.match(SYSTEM_PROMPT, /relays/i);
  assert.match(SYSTEM_PROMPT, /connectors/i);
  assert.match(SYSTEM_PROMPT, /Say "likely"/);
  assert.doesNotMatch(SYSTEM_PROMPT, /too far, cropped, or not a board/);
  assert.match(SYSTEM_PROMPT, /cropped region of a board is still valid/);
  assert.match(SYSTEM_PROMPT, /If a board is visible but you are unsure/);
  assert.match(SYSTEM_PROMPT, /set confidence to "low"/);
});

test('tells the model a photo may already be cropped', () => {
  const prompt = userPrompt(0, ['gold', 'palladium', 'tantalum', 'all']);
  assert.match(prompt, /tight crop/);
  assert.match(prompt, /Say "likely"/);
});
