import { metalColor } from './parts';
import { APP_URL, TYPE_LABELS, type Analysis } from '../../shared/types';

export function publicUrl(): string {
  const host = window.location.hostname;
  if (host === 'localhost' || host === '127.0.0.1') return APP_URL;
  return window.location.origin;
}

export async function buildShareCard(imageUrl: string, analysis: Analysis): Promise<Blob> {
  const image = await loadImage(imageUrl);
  await Promise.all([
    document.fonts.load('650 88px Fraunces').catch(() => undefined),
    document.fonts.load('560 34px Outfit').catch(() => undefined),
  ]);
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1350;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not draw the share card.');

  ctx.fillStyle = '#100e0b';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const glow = ctx.createRadialGradient(180, 0, 40, 180, 0, 520);
  glow.addColorStop(0, 'rgba(231, 194, 122, 0.28)');
  glow.addColorStop(1, 'rgba(231, 194, 122, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, canvas.width, 420);

  ctx.fillStyle = '#f6e2b4';
  ctx.font = '650 54px Fraunces, Georgia, serif';
  ctx.fillText('GoldSpotter', 64, 92);
  ctx.fillStyle = '#b3a794';
  ctx.font = '500 24px Outfit, sans-serif';
  ctx.fillText('Likely precious-metal candidates', 64, 132);

  const frame = { x: 64, y: 176, w: 952, h: 760, r: 36 };
  const scale = Math.min(frame.w / image.width, frame.h / image.height);
  const destW = image.width * scale;
  const destH = image.height * scale;
  const destX = frame.x + (frame.w - destW) / 2;
  const destY = frame.y + (frame.h - destH) / 2;

  ctx.save();
  roundRect(ctx, frame.x, frame.y, frame.w, frame.h, frame.r);
  ctx.clip();
  ctx.fillStyle = '#1a1611';
  ctx.fillRect(frame.x, frame.y, frame.w, frame.h);
  ctx.drawImage(image, destX, destY, destW, destH);
  for (const part of analysis.components) {
    const [x, y, w, h] = part.bbox;
    const color = metalColor(part);
    ctx.lineWidth = 6;
    ctx.strokeStyle = color;
    ctx.strokeRect(destX + x * destW, destY + y * destH, w * destW, h * destH);
    const name = part.label || TYPE_LABELS[part.type];
    if (w * destW > 120) drawLabel(ctx, name, destX + x * destW, destY + y * destH, color);
  }
  ctx.restore();

  ctx.beginPath();
  ctx.arc(128, 1048, 58, 0, Math.PI * 2);
  ctx.strokeStyle = '#e7c27a';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillStyle = '#f6e2b4';
  ctx.font = '650 64px Fraunces, Georgia, serif';
  ctx.textAlign = 'center';
  ctx.fillText(analysis.grade ?? '–', 128, analysis.grade ? 1070 : 1064);
  ctx.textAlign = 'left';

  ctx.fillStyle = '#f7f2ea';
  ctx.font = '600 28px Outfit, sans-serif';
  ctx.fillText(`${analysis.grade_label} · ${analysis.board_type}`.slice(0, 48), 214, 1024);
  ctx.fillStyle = '#d9d0c2';
  ctx.font = '460 30px Outfit, sans-serif';
  const lines = wrap(ctx, analysis.verdict, 760, 3);
  lines.forEach((line, index) => ctx.fillText(line, 214, 1070 + index * 38));

  ctx.strokeStyle = 'rgba(231, 194, 122, 0.35)';
  ctx.beginPath();
  ctx.moveTo(64, 1224);
  ctx.lineTo(1016, 1224);
  ctx.stroke();
  ctx.fillStyle = '#f6e2b4';
  ctx.font = '600 28px Outfit, sans-serif';
  ctx.fillText('Scanned with GoldSpotter', 64, 1280);
  ctx.fillStyle = '#b3a794';
  ctx.font = '500 24px Outfit, sans-serif';
  ctx.fillText(publicUrl().replace(/^https?:\/\//, ''), 64, 1316);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not export the card.'))), 'image/png');
  });
}

export async function shareCard(blob: Blob, text: string): Promise<'shared' | 'downloaded'> {
  const file = new File([blob], 'goldspotter-scan.png', { type: 'image/png' });
  try {
    if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: 'GoldSpotter', text });
      return 'shared';
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'goldspotter-scan.png';
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2500);
  return 'downloaded';
}

function drawLabel(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, color: string): void {
  ctx.font = '600 22px Outfit, sans-serif';
  const label = text.length > 28 ? `${text.slice(0, 27)}…` : text;
  const width = ctx.measureText(label).width + 20;
  const top = Math.max(188, y - 34);
  ctx.fillStyle = color;
  ctx.fillRect(x, top, width, 30);
  ctx.fillStyle = '#1a1206';
  ctx.fillText(label, x + 10, top + 22);
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';
  for (let index = 0; index < words.length; index += 1) {
    const next = current ? `${current} ${words[index]}` : words[index];
    if (ctx.measureText(next).width <= maxWidth) {
      current = next;
      continue;
    }
    const overflow = current || words[index];
    const more = Boolean(current) || index < words.length - 1;
    if (lines.length === maxLines - 1) {
      lines.push(fit(ctx, more ? `${overflow}…` : overflow, maxWidth));
      return lines;
    }
    if (current) lines.push(current);
    current = current ? words[index] : '';
    if (!current) lines.push(fit(ctx, words[index], maxWidth));
  }
  if (current && lines.length < maxLines) lines.push(current);
  return lines;
}

function fit(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let clipped = text;
  while (clipped.length > 1 && ctx.measureText(clipped).width > maxWidth) clipped = clipped.slice(0, -1);
  return clipped;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Could not load the photo for the share card.'));
    image.src = url;
  });
}
