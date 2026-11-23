export type NormCrop = { x: number; y: number; w: number; h: number };
export type Corner = 'nw' | 'ne' | 'sw' | 'se';
export type Fit = { left: number; top: number; width: number; height: number };

const MIN_FRACTION = 0.12;

export function clampNormCrop(crop: NormCrop, min = MIN_FRACTION): NormCrop {
  const w = Math.min(1, Math.max(min, crop.w));
  const h = Math.min(1, Math.max(min, crop.h));
  const x = Math.min(Math.max(0, crop.x), 1 - w);
  const y = Math.min(Math.max(0, crop.y), 1 - h);
  return { x, y, w, h };
}

export function moveCrop(crop: NormCrop, dx: number, dy: number): NormCrop {
  return clampNormCrop({ ...crop, x: crop.x + dx, y: crop.y + dy });
}

export function scaleCrop(crop: NormCrop, factor: number): NormCrop {
  const cx = crop.x + crop.w / 2;
  const cy = crop.y + crop.h / 2;
  const w = crop.w * factor;
  const h = crop.h * factor;
  return clampNormCrop({ x: cx - w / 2, y: cy - h / 2, w, h });
}

export function resizeCorner(crop: NormCrop, corner: Corner, px: number, py: number): NormCrop {
  const right = crop.x + crop.w;
  const bottom = crop.y + crop.h;
  let x = crop.x;
  let y = crop.y;
  let nextRight = right;
  let nextBottom = bottom;
  if (corner === 'nw' || corner === 'sw') x = px;
  else nextRight = px;
  if (corner === 'nw' || corner === 'ne') y = py;
  else nextBottom = py;
  if (nextRight < x) [x, nextRight] = [nextRight, x];
  if (nextBottom < y) [y, nextBottom] = [nextBottom, y];
  return clampNormCrop({ x, y, w: nextRight - x, h: nextBottom - y });
}

export function fitContain(containerW: number, containerH: number, naturalW: number, naturalH: number): Fit {
  const scale = Math.min(containerW / Math.max(1, naturalW), containerH / Math.max(1, naturalH));
  const width = naturalW * scale;
  const height = naturalH * scale;
  return { left: (containerW - width) / 2, top: (containerH - height) / 2, width, height };
}

export function pointToNorm(localX: number, localY: number, fit: Fit): { x: number; y: number } {
  return { x: (localX - fit.left) / fit.width, y: (localY - fit.top) / fit.height };
}
