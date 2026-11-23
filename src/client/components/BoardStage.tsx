import { useLayoutEffect, useRef, useState } from 'react';
import { layoutMarkers } from '../lib/markers';
import { metalColor, type MarkedPart } from '../lib/parts';

const BADGE = 26;

export function BoardStage({
  src,
  parts,
  selectedId,
  onSelect,
  scanning,
}: {
  src: string;
  parts: MarkedPart[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  scanning?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    const measure = () => setSize({ width: node.clientWidth, height: node.clientHeight });
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const spots = size.width > 0 ? layoutMarkers(parts.map((part) => part.bbox), size.width, size.height, BADGE) : [];

  return (
    <div ref={ref} className={scanning ? 'stage is-scanning' : 'stage'}>
      <img src={src} alt="Circuit board being scanned" onLoad={() => ref.current && setSize({ width: ref.current.clientWidth, height: ref.current.clientHeight })} />
      {scanning ? <div className="scanline" /> : null}
      <svg className="boxes" viewBox="0 0 1 1" preserveAspectRatio="none" aria-hidden="true">
        {parts.map((part) => {
          const [x, y, w, h] = part.bbox;
          const selected = part.id === selectedId;
          const color = metalColor(part);
          return (
            <rect
              key={part.id}
              x={x}
              y={y}
              width={w}
              height={h}
              fill={color}
              fillOpacity={part.review === 'rejected' ? 0.02 : selected ? 0.24 : 0.1}
              stroke={color}
              strokeWidth={selected ? 3 : 2}
              vectorEffect="non-scaling-stroke"
              strokeOpacity={part.review === 'rejected' ? 0.35 : 1}
              strokeDasharray={part.review === 'rejected' ? '6 4' : undefined}
            />
          );
        })}
      </svg>
      {parts.map((part, index) => {
        const spot = spots[index];
        if (!spot) return null;
        return (
          <button
            key={part.id}
            type="button"
            className={`marker is-${part.review}${part.id === selectedId ? ' is-selected' : ''}`}
            style={{ left: spot.left, top: spot.top, width: BADGE, height: BADGE, background: metalColor(part) }}
            onClick={() => onSelect?.(part.id)}
            aria-label={`${index + 1}. ${part.label}`}
          >
            {index + 1}
          </button>
        );
      })}
    </div>
  );
}
