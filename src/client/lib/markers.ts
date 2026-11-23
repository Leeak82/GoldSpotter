import type { BBox } from '../../shared/types';

export type MarkerSpot = { left: number; top: number };

/**
 * Places one numbered badge per box, in pixels. Each badge stays fully inside the
 * image and never sits on top of another badge: it tries the box corners first,
 * then steps down and across until it finds free room.
 */
export function layoutMarkers(boxes: BBox[], width: number, height: number, size = 26, gap = 3): MarkerSpot[] {
  const placed: MarkerSpot[] = [];
  const maxLeft = Math.max(0, width - size);
  const maxTop = Math.max(0, height - size);
  const clampSpot = (left: number, top: number): MarkerSpot => ({
    left: Math.round(Math.min(maxLeft, Math.max(0, left))),
    top: Math.round(Math.min(maxTop, Math.max(0, top))),
  });
  const collides = (spot: MarkerSpot) =>
    placed.some((other) => Math.abs(other.left - spot.left) < size + gap && Math.abs(other.top - spot.top) < size + gap);

  for (const [x, y, w, h] of boxes) {
    const left = x * width;
    const top = y * height;
    const right = (x + w) * width;
    const bottom = (y + h) * height;
    const candidates = [
      clampSpot(left + 2, top + 2),
      clampSpot(right - size - 2, top + 2),
      clampSpot(left + 2, bottom - size - 2),
      clampSpot(right - size - 2, bottom - size - 2),
      clampSpot(left - size - gap, top),
      clampSpot(left, top - size - gap),
    ];
    let spot = candidates.find((candidate) => !collides(candidate));
    if (!spot) {
      const step = size + gap;
      search: for (let dy = 0; dy <= height; dy += step) {
        for (let dx = 0; dx <= width; dx += step) {
          const candidate = clampSpot(left + dx, top + dy);
          if (!collides(candidate)) {
            spot = candidate;
            break search;
          }
        }
      }
    }
    placed.push(spot ?? candidates[0]);
  }
  return placed;
}
