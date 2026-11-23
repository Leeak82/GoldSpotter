import { useEffect, useRef, useState } from 'react';
import {
  fitContain,
  moveCrop,
  pointToNorm,
  resizeCorner,
  scaleCrop,
  type Corner,
  type Fit,
  type NormCrop,
} from '../lib/crop';

const CORNERS: Corner[] = ['nw', 'ne', 'sw', 'se'];

export function CropView({
  url,
  onUseFull,
  onCrop,
  onClose,
}: {
  url: string;
  onUseFull: () => void;
  onCrop: (blob: Blob) => void;
  onClose: () => void;
}) {
  const rootRef = useRef<HTMLElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const cropRef = useRef<NormCrop>({ x: 0.08, y: 0.08, w: 0.84, h: 0.84 });
  const [crop, setCrop] = useState<NormCrop>(cropRef.current);
  const [fit, setFit] = useState<Fit | null>(null);
  const [busy, setBusy] = useState(false);
  const dragRef = useRef<
    | { kind: 'move'; pointerId: number; lastX: number; lastY: number }
    | { kind: 'corner'; pointerId: number; corner: Corner }
    | { kind: 'pinch'; ids: number[]; distance: number; crop: NormCrop }
    | null
  >(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());

  useEffect(() => {
    const root = rootRef.current;
    const viewport = window.visualViewport;
    if (!root || !viewport) return;
    const apply = () => {
      root.style.height = `${viewport.height}px`;
      root.style.top = `${viewport.offsetTop}px`;
    };
    apply();
    viewport.addEventListener('resize', apply);
    viewport.addEventListener('scroll', apply);
    return () => {
      viewport.removeEventListener('resize', apply);
      viewport.removeEventListener('scroll', apply);
    };
  }, []);

  useEffect(() => {
    const frame = frameRef.current;
    const image = imageRef.current;
    if (!frame || !image) return;
    const measure = () => {
      if (!image.naturalWidth) return;
      setFit(fitContain(frame.clientWidth, frame.clientHeight, image.naturalWidth, image.naturalHeight));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(frame);
    image.addEventListener('load', measure);
    return () => {
      observer.disconnect();
      image.removeEventListener('load', measure);
    };
  }, [url]);

  function update(next: NormCrop) {
    cropRef.current = next;
    setCrop(next);
  }

  function localPoint(event: React.PointerEvent) {
    const frame = frameRef.current?.getBoundingClientRect();
    if (!frame || !fit) return null;
    return pointToNorm(event.clientX - frame.left, event.clientY - frame.top, fit);
  }

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.current.size === 2 && fit) {
      const [a, b] = [...pointers.current.values()];
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      dragRef.current = { kind: 'pinch', ids: [...pointers.current.keys()], distance, crop: cropRef.current };
      return;
    }
    const point = localPoint(event);
    if (!point || !fit) return;
    const handle = (event.target as HTMLElement).dataset.corner as Corner | undefined;
    if (handle) {
      dragRef.current = { kind: 'corner', pointerId: event.pointerId, corner: handle };
      event.currentTarget.setPointerCapture(event.pointerId);
      return;
    }
    const inside =
      point.x >= cropRef.current.x &&
      point.x <= cropRef.current.x + cropRef.current.w &&
      point.y >= cropRef.current.y &&
      point.y <= cropRef.current.y + cropRef.current.h;
    if (!inside) return;
    dragRef.current = { kind: 'move', pointerId: event.pointerId, lastX: point.x, lastY: point.y };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!pointers.current.has(event.pointerId) && dragRef.current?.kind !== 'pinch') {
      pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    } else if (pointers.current.has(event.pointerId)) {
      pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    }
    const drag = dragRef.current;
    if (!drag || !fit) return;
    if (drag.kind === 'pinch' && pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()];
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      if (drag.distance > 0) update(scaleCrop(drag.crop, distance / drag.distance));
      return;
    }
    const point = localPoint(event);
    if (!point) return;
    if (drag.kind === 'corner' && drag.pointerId === event.pointerId) {
      update(resizeCorner(cropRef.current, drag.corner, point.x, point.y));
    }
    if (drag.kind === 'move' && drag.pointerId === event.pointerId) {
      update(moveCrop(cropRef.current, point.x - drag.lastX, point.y - drag.lastY));
      drag.lastX = point.x;
      drag.lastY = point.y;
    }
  }

  function onPointerUp(event: React.PointerEvent<HTMLDivElement>) {
    pointers.current.delete(event.pointerId);
    if (dragRef.current?.kind === 'pinch' || (dragRef.current && 'pointerId' in dragRef.current && dragRef.current.pointerId === event.pointerId)) {
      dragRef.current = null;
    }
  }

  async function confirmCrop() {
    const image = imageRef.current;
    if (!image || busy) return;
    setBusy(true);
    const source = cropRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(source.w * image.naturalWidth));
    canvas.height = Math.max(1, Math.round(source.h * image.naturalHeight));
    const context = canvas.getContext('2d');
    if (!context) {
      setBusy(false);
      return;
    }
    context.drawImage(
      image,
      source.x * image.naturalWidth,
      source.y * image.naturalHeight,
      source.w * image.naturalWidth,
      source.h * image.naturalHeight,
      0,
      0,
      canvas.width,
      canvas.height,
    );
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
    setBusy(false);
    if (blob) onCrop(blob);
  }

  const box =
    fit && crop
      ? {
          left: fit.left + crop.x * fit.width,
          top: fit.top + crop.y * fit.height,
          width: crop.w * fit.width,
          height: crop.h * fit.height,
        }
      : null;

  return (
    <section className="cropper" ref={rootRef}>
      <div className="camera-top">
        <button type="button" className="text-btn" onClick={onClose}>
          Close
        </button>
        <p className="light-hint">Drag the corners</p>
      </div>
      <div
        className="crop-frame"
        ref={frameRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <img ref={imageRef} src={url} alt="Photo to crop" draggable={false} />
        {box ? (
          <div className="crop-box" style={{ left: box.left, top: box.top, width: box.width, height: box.height }}>
            {CORNERS.map((corner) => (
              <span key={corner} className={`crop-handle is-${corner}`} data-corner={corner} role="presentation" />
            ))}
          </div>
        ) : null}
      </div>
      <div className="crop-actions">
        <button type="button" className="btn btn-ghost" onClick={onUseFull} disabled={busy}>
          Use full photo
        </button>
        <button type="button" className="btn btn-primary" onClick={() => void confirmCrop()} disabled={busy}>
          Crop & scan
        </button>
      </div>
    </section>
  );
}
