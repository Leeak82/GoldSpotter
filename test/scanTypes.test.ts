import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  componentCategories,
  componentVisible,
  detectionInstructions,
  parseScanTypes,
  scanSummary,
  toggleScanType,
} from '../src/shared/scanTypes';
import type { Component } from '../src/shared/types';

function part(overrides: Partial<Component>): Component {
  return {
    label: 'Part',
    type: 'other',
    bbox: [0.1, 0.1, 0.2, 0.2],
    precious_metals: [],
    gold_level: 'none',
    value_potential: 'low',
    confidence: 'medium',
    note: 'Visible part.',
    review: 'unreviewed',
    ...overrides,
  };
}

test('blocks turning off the last scan type', () => {
  const result = toggleScanType(['gold'], 'gold');
  assert.equal(result.blocked, true);
  assert.deepEqual(result.types, ['gold']);
});

test('keeps a stable summary of the switches that are on', () => {
  assert.equal(scanSummary(['palladium', 'gold']), 'Scanning: Gold, Palladium');
});

test('filters an existing scan without dropping unrelated saved parts', () => {
  const finger = part({ type: 'gold_fingers', precious_metals: ['gold'] });
  const mlcc = part({ type: 'mlcc', precious_metals: ['palladium', 'silver'] });
  const crystal = part({ type: 'crystal_oscillator' });
  assert.equal(componentVisible(finger, ['palladium']), false);
  assert.equal(componentVisible(mlcc, ['palladium']), true);
  assert.equal(componentVisible(mlcc, ['silver']), true);
  assert.equal(componentVisible(crystal, ['gold', 'silver']), false);
  assert.equal(componentVisible(crystal, ['all']), true);
  assert.deepEqual(componentCategories(finger), ['gold']);
  const bareChip = part({ type: 'ic_chip', precious_metals: [] });
  const bareMlcc = part({ type: 'mlcc', precious_metals: [] });
  assert.equal(componentVisible(bareChip, ['all']), true);
  assert.equal(componentVisible(bareMlcc, ['all']), true);
  assert.equal(componentVisible(bareChip, ['gold']), true);
  assert.equal(componentVisible(bareMlcc, ['gold']), false);
});

test('names only enabled groups in the model prompt', () => {
  const text = detectionInstructions(['gold', 'tantalum']);
  assert.match(text, /Gold/);
  assert.match(text, /Tantalum/);
  assert.match(text, /Disabled, do not return these: Silver, Palladium, Platinum, All components/);
});

test('an empty type list stays empty and a missing list means all types', () => {
  assert.deepEqual(parseScanTypes([]), []);
  assert.equal(parseScanTypes(undefined).length, 6);
});
