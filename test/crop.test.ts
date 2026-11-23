import assert from 'node:assert/strict';
import { test } from 'node:test';
import { clampNormCrop, fitContain, moveCrop, resizeCorner, scaleCrop } from '../src/client/lib/crop';

test('keeps a crop inside the photo', () => {
  const crop = clampNormCrop({ x: -0.2, y: 0.9, w: 0.5, h: 0.5 });
  assert.ok(crop.x >= 0);
  assert.ok(crop.y >= 0);
  assert.ok(crop.x + crop.w <= 1);
  assert.ok(crop.y + crop.h <= 1);
});

test('moves without changing the framed size', () => {
  const moved = moveCrop({ x: 0.1, y: 0.1, w: 0.4, h: 0.3 }, 0.2, 0.05);
  assert.equal(moved.w, 0.4);
  assert.equal(moved.h, 0.3);
  assert.ok(Math.abs(moved.x - 0.3) < 1e-9);
});

test('dragging a corner keeps the opposite corner fixed', () => {
  const next = resizeCorner({ x: 0.2, y: 0.2, w: 0.4, h: 0.4 }, 'se', 0.9, 0.8);
  assert.ok(Math.abs(next.x - 0.2) < 1e-9);
  assert.ok(Math.abs(next.y - 0.2) < 1e-9);
  assert.ok(Math.abs(next.w - 0.7) < 1e-9);
  assert.ok(Math.abs(next.h - 0.6) < 1e-9);
});

test('pinch scales around the center until the photo edge', () => {
  const scaled = scaleCrop({ x: 0.25, y: 0.25, w: 0.5, h: 0.5 }, 3);
  assert.equal(scaled.x, 0);
  assert.equal(scaled.y, 0);
  assert.equal(scaled.w, 1);
  assert.equal(scaled.h, 1);
});

test('letterboxes a wide photo inside the frame', () => {
  const fit = fitContain(390, 700, 800, 400);
  assert.equal(fit.width, 390);
  assert.equal(fit.height, 195);
  assert.equal(fit.left, 0);
  assert.ok(fit.top > 0);
});
