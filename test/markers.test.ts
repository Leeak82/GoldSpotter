import assert from 'node:assert/strict';
import { test } from 'node:test';
import { layoutMarkers } from '../src/client/lib/markers';
import type { BBox } from '../src/shared/types';

const W = 360;
const H = 203;
const SIZE = 26;

function inside(spot: { left: number; top: number }) {
  return spot.left >= 0 && spot.top >= 0 && spot.left + SIZE <= W && spot.top + SIZE <= H;
}

test('badges on boxes at the right edge stay inside the image', () => {
  const spots = layoutMarkers([[0.97, 0.4, 0.03, 0.1], [0.95, 0.95, 0.05, 0.05]], W, H, SIZE);
  for (const spot of spots) assert.ok(inside(spot), JSON.stringify(spot));
});

test('badges for overlapping boxes do not overlap each other', () => {
  const boxes: BBox[] = [
    [0.6, 0.45, 0.08, 0.1],
    [0.6, 0.46, 0.08, 0.1],
    [0.61, 0.47, 0.08, 0.1],
    [0.62, 0.45, 0.08, 0.1],
  ];
  const spots = layoutMarkers(boxes, W, H, SIZE);
  for (let i = 0; i < spots.length; i += 1) {
    assert.ok(inside(spots[i]));
    for (let j = 0; j < i; j += 1) {
      const apart = Math.abs(spots[i].left - spots[j].left) >= SIZE || Math.abs(spots[i].top - spots[j].top) >= SIZE;
      assert.ok(apart, `badge ${i} overlaps badge ${j}`);
    }
  }
});

test('a badge sits on its own box when there is room', () => {
  const [spot] = layoutMarkers([[0.1, 0.2, 0.4, 0.5]], W, H, SIZE);
  assert.ok(spot.left >= 0.1 * W && spot.left <= 0.5 * W);
  assert.ok(spot.top >= 0.2 * H && spot.top <= 0.7 * H);
});
