import assert from 'node:assert/strict';
import { test } from 'node:test';
import { finalizeAnalysis, mergeParts } from '../src/shared/postprocess';
import type { Analysis, Component } from '../src/shared/types';
import { box2dToBBox, validateAnalysis } from '../src/shared/validate';

function part(overrides: Partial<Component>): Component {
  return {
    label: 'Part',
    type: 'other',
    bbox: [0.1, 0.1, 0.1, 0.1],
    precious_metals: [],
    gold_level: 'none',
    value_potential: 'low',
    confidence: 'medium',
    note: 'x',
    review: 'unreviewed',
    ...overrides,
  };
}

function analysis(components: Component[]): Analysis {
  return {
    board_type: 'Board',
    outcome: 'candidates',
    grade: 'B',
    grade_label: 'Medium grade',
    verdict: 'A long model verdict that should not be shown.',
    summary: 'A long model summary.',
    recovery_tips: [],
    retake_tips: [],
    components,
    disclaimer: '',
  };
}

test('converts Gemini box_2d to x, y, w, h', () => {
  assert.deepEqual(box2dToBBox([100, 200, 500, 600]), [0.2, 0.1, 0.4, 0.4]);
  assert.deepEqual(box2dToBBox([500, 600, 100, 200]), [0.2, 0.1, 0.4, 0.4]);
  assert.equal(box2dToBBox([100, 200, 103, 600]), null);
});

test('a resistor is titled and described as a resistor, whatever the model wrote', () => {
  const out = finalizeAnalysis(
    analysis([part({ type: 'resistor', label: 'MLCC ceramic capacitor', note: 'This MLCC ceramic capacitor...', marking: '1R00', bbox: [0.6, 0.4, 0.06, 0.05] })]),
  );
  const resistor = out.components[0];
  assert.equal(resistor.label, 'SMD resistor (1R00)');
  assert.doesNotMatch(resistor.note, /MLCC|capacitor/i);
  assert.deepEqual(resistor.precious_metals, []);
});

test('duplicate boxes on the same part merge into one entry', () => {
  const groups = mergeParts([
    part({ type: 'qfp_chip', bbox: [0.1, 0.2, 0.4, 0.5] }),
    part({ type: 'qfp_chip', bbox: [0.12, 0.22, 0.38, 0.5] }),
  ]);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].count, 1);
});

test('a row of neighbouring resistors becomes one cluster hotspot', () => {
  const out = finalizeAnalysis(
    analysis([
      part({ type: 'resistor', bbox: [0.6, 0.4, 0.07, 0.06], marking: '1R00' }),
      part({ type: 'resistor', bbox: [0.6, 0.48, 0.07, 0.06], marking: '1R00' }),
      part({ type: 'resistor', bbox: [0.6, 0.56, 0.07, 0.06], marking: '1R00' }),
    ]),
  );
  assert.equal(out.components.length, 1);
  assert.equal(out.components[0].label, 'SMD resistors ×3 (1R00)');
  assert.equal(out.components[0].count, 3);
});

test('gold pads rank first, the SOIC keeps its own package name, and the headline is short', () => {
  const out = finalizeAnalysis(
    analysis([
      part({ type: 'soic_chip', bbox: [0.44, 0.7, 0.18, 0.25] }),
      part({ type: 'mlcc', bbox: [0.55, 0.05, 0.08, 0.08] }),
      part({ type: 'qfp_chip', bbox: [0.1, 0.2, 0.4, 0.5] }),
      part({ type: 'gold_plated_pads', bbox: [0.3, 0.08, 0.15, 0.1] }),
    ]),
  );
  assert.deepEqual(
    out.components.map((item) => item.type),
    ['gold_plated_pads', 'qfp_chip', 'soic_chip', 'mlcc'],
  );
  assert.equal(out.components[2].label, 'SOIC chip');
  assert.equal(out.grade, 'C');
  assert.equal(out.verdict, '3 likely gold spots');
  assert.ok(out.summary.length <= 80, out.summary);
  assert.match(out.summary, /gold-plated pads/);
});

test('the same parts in a different order give the identical result', () => {
  const parts = [
    part({ type: 'qfp_chip', bbox: [0.1, 0.2, 0.4, 0.5], confidence: 'high' }),
    part({ type: 'gold_plated_pads', bbox: [0.3, 0.08, 0.15, 0.1] }),
    part({ type: 'resistor', bbox: [0.6, 0.4, 0.07, 0.06] }),
  ];
  const a = finalizeAnalysis(analysis(parts));
  const b = finalizeAnalysis(analysis([...parts].reverse()));
  assert.deepEqual(a, b);
});

test('a reply in the new schema validates and finalizes', () => {
  const result = validateAnalysis({
    board_type: 'Controller board',
    outcome: 'candidates',
    grade: 'none',
    verdict: 'Board with a QFP chip.',
    components: [
      { type: 'qfp_chip', box_2d: [200, 100, 700, 500], marking: '', confidence: 'high' },
      { type: 'resistor', box_2d: [350, 600, 420, 680], marking: '1R00', count: 1, confidence: 'high' },
    ],
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  const out = finalizeAnalysis(result.value);
  assert.equal(out.components[0].label, 'QFP chip');
  assert.deepEqual(out.components[0].bbox, [0.1, 0.2, 0.4, 0.5]);
  assert.equal(out.components[1].label, 'SMD resistor (1R00)');
  assert.ok(out.grade);
});
