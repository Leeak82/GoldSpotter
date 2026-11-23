import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SYSTEM_PROMPT, userPrompt } from '../src/server/prompt';

test('names every package type with a visual cue', () => {
  for (const type of ['gold_fingers', 'gold_plated_pads', 'qfp_chip', 'soic_chip', 'bga_chip', 'resistor', 'mlcc', 'tantalum_capacitor', 'inductor_diode']) {
    assert.match(SYSTEM_PROMPT, new RegExp(`- ${type}:`));
  }
  assert.match(SYSTEM_PROMPT, /ENIG/);
  assert.match(SYSTEM_PROMPT, /white printed digits/);
  assert.match(SYSTEM_PROMPT, /no printing/);
});

test('asks for Gemini native boxes and no duplicates', () => {
  assert.match(SYSTEM_PROMPT, /\[ymin, xmin, ymax, xmax\]/);
  assert.match(SYSTEM_PROMPT, /0 to 1000/);
  assert.match(SYSTEM_PROMPT, /Never list the same part twice/);
  assert.match(SYSTEM_PROMPT, /even a close-up crop/);
});

test('the user prompt asks for pads and small parts', () => {
  const prompt = userPrompt(0, ['gold', 'palladium', 'tantalum', 'all']);
  assert.match(prompt, /gold, silver or copper/);
  assert.match(userPrompt(1, ['gold']), /0 to 1000/);
});

test('pads are only gold when they look gold', () => {
  assert.match(SYSTEM_PROMPT, /- tinned_pads:/);
  assert.match(SYSTEM_PROMPT, /HASL/);
  assert.match(SYSTEM_PROMPT, /never call a pad, finger or via gold unless it is visibly gold/);
  assert.match(SYSTEM_PROMPT, /"finish"/);
});
