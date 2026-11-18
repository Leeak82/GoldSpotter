import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SAFE_TIPS } from '../src/shared/types';
import { clampBBox, parseModelOutput, validateAnalysis } from '../src/shared/validate';

const validComponent = {
  label: 'Gold fingers',
  type: 'edge connector',
  bbox: [0.05, 0.7, 0.9, 0.2],
  precious_metals: ['Gold', 'copper', 'gold'],
  gold_level: 'high',
  confidence: 0.82,
  note: 'Contacts along the bottom edge.',
};

function payload(overrides: Record<string, unknown> = {}) {
  return {
    board_type: 'RAM stick',
    grade: 'B',
    verdict: 'The fingers are the reason to keep this stick.',
    recovery_tips: ['Shear the finger edge and bag it separately.'],
    components: [validComponent],
    ...overrides,
  };
}

test('clamps a box that runs past the right and bottom edges', () => {
  assert.deepEqual(clampBBox([0.2, 0.3, 0.9, 0.9]), [0.2, 0.3, 0.8, 0.7]);
});

test('clamps negative origins into the frame', () => {
  assert.deepEqual(clampBBox([-0.2, -0.4, 0.5, 0.3]), [0, 0, 0.5, 0.3]);
});

test('drops a box that is too small after clamping', () => {
  assert.equal(clampBBox([0.99, 0.2, 0.2, 0.2]), null);
  assert.equal(clampBBox([0.1, 0.1, 0.005, 0.4]), null);
});

test('accepts percent-style boxes and object boxes', () => {
  assert.deepEqual(clampBBox([10, 20, 30, 40]), [0.1, 0.2, 0.3, 0.4]);
  assert.deepEqual(clampBBox({ x: '0.1', y: 0.2, width: 0.3, height: 0.25 }), [0.1, 0.2, 0.3, 0.25]);
});

test('normalizes a full analysis and filters metals', () => {
  const result = validateAnalysis(payload());
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.value.grade, 'B');
  assert.equal(result.value.grade_label, 'Medium grade');
  assert.equal(result.value.components[0].type, 'gold_fingers');
  assert.deepEqual(result.value.components[0].precious_metals, ['gold']);
  assert.equal(result.value.components[0].confidence, 'high');
  assert.equal(result.value.components[0].value_potential, 'high');
  assert.equal(result.value.board_type, 'RAM stick');
});

test('clamps confidence and coerces an unknown gold level', () => {
  const result = validateAnalysis(
    payload({
      components: [{ ...validComponent, confidence: 1.8, gold_level: 'shiny', bbox: [0, 0, 0.4, 0.4] }],
    }),
  );
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.value.components[0].confidence, 'high');
  assert.equal(result.value.components[0].gold_level, 'none');
});

test('rejects a missing grade and an empty verdict', () => {
  assert.equal(validateAnalysis(payload({ grade: 'S' })).ok, false);
  assert.equal(validateAnalysis(payload({ verdict: '   ' })).ok, false);
});

test('drops unsafe refining tips and replaces an unsafe verdict', () => {
  const result = validateAnalysis(
    payload({
      verdict: 'Dissolve the fingers in aqua regia.',
      recovery_tips: ['Use nitric acid on the pins.', 'Bag the fingers separately.'],
      components: [{ ...validComponent, note: 'Boil in acid to see the gold.' }],
    }),
  );
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.match(result.value.verdict, /do not chemically refine/i);
  assert.deepEqual(result.value.recovery_tips, ['Bag the fingers separately.']);
  assert.match(result.value.components[0].note, /Refining steps were removed/);
});

test('fills safe default tips when the model gives none', () => {
  const result = validateAnalysis(payload({ recovery_tips: [] }));
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.value.recovery_tips, SAFE_TIPS);
});

test('parses fenced JSON and trailing commas', () => {
  const parsed = parseModelOutput('Sure\n```json\n{"grade":"A","ok":true,}\n```\ntrailing');
  assert.deepEqual(parsed, { grade: 'A', ok: true });
});

test('rewrites a gold-found claim and bands extreme confidence', () => {
  const result = validateAnalysis(
    payload({
      verdict: 'Gold found on the edge, worth about $40 and 2 grams.',
      outcome: 'candidates',
      components: [{ ...validComponent, confidence: -4, why: 'Gold found in the fingers.' }],
    }),
  );
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(/gold found/i.test(result.value.verdict), false);
  assert.equal(/\$/.test(result.value.verdict), false);
  assert.equal(result.value.components[0].confidence, 'low');
  assert.equal(/gold found/i.test(result.value.components[0].note), false);
});

test('unknown and bad photo do not pretend to be a grade', () => {
  const unknown = validateAnalysis({
    outcome: 'unknown',
    verdict: 'The board is there, but the fingers are not clear enough.',
    components: [],
  });
  assert.equal(unknown.ok, true);
  if (!unknown.ok) return;
  assert.equal(unknown.value.outcome, 'unknown');
  assert.equal(unknown.value.grade, null);
  assert.ok(unknown.value.retake_tips.length > 0);

  const bad = validateAnalysis({
    outcome: 'bad_photo',
    verdict: 'Glare covers the board.',
    components: [],
  });
  assert.equal(bad.ok, true);
  if (!bad.ok) return;
  assert.equal(bad.value.grade_label, 'Bad photo');
});

test('caps the component list and skips a component without a box', () => {
  const components = Array.from({ length: 20 }, (_, index) => ({
    ...validComponent,
    label: `Part ${index}`,
    bbox: index === 3 ? [2, 2, 0, 0] : [0.1, 0.1, 0.2, 0.2],
  }));
  const result = validateAnalysis(payload({ components }));
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.value.components.length, 16);
  assert.equal(
    result.value.components.some((part) => part.label === 'Part 3'),
    false,
  );
});
