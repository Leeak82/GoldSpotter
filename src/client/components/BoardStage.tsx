import { TYPE_LABELS } from '../../shared/types';
import { metalColor, type MarkedPart } from '../lib/parts';

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
  return (
    <div className={scanning ? 'stage is-scanning' : 'stage'}>
      <img src={src} alt="Circuit board being scanned" />
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
              fillOpacity={part.review === 'rejected' ? 0.02 : selected ? 0.22 : 0.1}
              stroke={color}
              strokeWidth={selected ? 0.012 : 0.006}
              strokeOpacity={part.review === 'rejected' ? 0.35 : 1}
              strokeDasharray={part.review === 'rejected' ? '0.02 0.014' : undefined}
              rx={0.008}
            />
          );
        })}
      </svg>
      {parts.map((part, index) => (
        <button
          key={part.id}
          type="button"
          className={`marker is-${part.review}${part.id === selectedId ? ' is-selected' : ''}`}
          style={{
            left: `${(part.bbox[0] + Math.min(part.bbox[2], 0.08)) * 100}%`,
            top: `${part.bbox[1] * 100}%`,
            color: '#1a1206',
            background: metalColor(part),
          }}
          onClick={() => onSelect?.(part.id)}
          aria-label={`${index + 1}. ${part.label}`}
        >
          {index + 1}
          <span className="marker-name">{part.label || TYPE_LABELS[part.type]}</span>
        </button>
      ))}
    </div>
  );
}
