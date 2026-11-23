import { useEffect, useState } from 'react';
import type { ScanType } from '../../shared/scanTypes';
import {
  CONFIDENCE_LABELS,
  METAL_COLORS,
  METAL_LABELS,
  VALUE_ASSUMPTIONS,
  type Analysis,
  type ReviewState,
} from '../../shared/types';
import { BoardStage } from '../components/BoardStage';
import { CoffeeLink } from '../components/CoffeeLink';
import { GradeMark } from '../components/GradeMark';
import { ScanTypeSwitches } from '../components/ScanTypeSwitches';
import { confidenceText, metalColor, primaryMetal, visibleParts } from '../lib/parts';

export function ResultsView({
  imageUrl,
  analysis,
  scanTypes,
  scannedTypes,
  typeHint,
  onToggleType,
  onReview,
  onShare,
  onAgain,
  sharing,
}: {
  imageUrl: string;
  analysis: Analysis;
  scanTypes: ScanType[];
  scannedTypes: ScanType[];
  typeHint: string | null;
  onToggleType: (id: ScanType) => void;
  onReview: (id: string, review: ReviewState) => void;
  onShare: () => void;
  onAgain: () => void;
  sharing: boolean;
}) {
  const parts = visibleParts(analysis.components, scanTypes);
  const [selected, setSelected] = useState<string | null>(parts[0]?.id ?? null);
  const selectedPart = parts.find((part) => part.id === selected) ?? null;
  const missed = scanTypes.filter((type) => !scannedTypes.includes(type));

  useEffect(() => {
    setSelected((current) => (current && parts.some((part) => part.id === current) ? current : (parts[0]?.id ?? null)));
  }, [analysis, scanTypes]);

  useEffect(() => {
    if (!selected) return;
    document.getElementById(selected)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [selected]);

  const confirmed = parts.filter((part) => part.review === 'confirmed').length;
  const rejected = parts.filter((part) => part.review === 'rejected').length;

  return (
    <section className="results rise">
      <BoardStage src={imageUrl} parts={parts} selectedId={selected} onSelect={setSelected} />
      {parts.length > 0 ? <MetalTally parts={parts} /> : null}
      <p className="tap-hint">Tap a number to confirm or reject it.</p>
      {selectedPart ? (
        <div className="review-dock">
          <p>
            <strong>{selectedPart.label}</strong>
            <span>Likely {primaryMetal(selectedPart) ? METAL_LABELS[primaryMetal(selectedPart)!] : 'non-precious'} · {confidenceText(selectedPart.confidence)} confidence</span>
          </p>
          <div>
            <button type="button" className={selectedPart.review === 'confirmed' ? 'is-on' : ''} onClick={() => onReview(selectedPart.id, 'confirmed')}>
              Confirm
            </button>
            <button type="button" className={selectedPart.review === 'rejected' ? 'is-on' : ''} onClick={() => onReview(selectedPart.id, 'rejected')}>
              Reject
            </button>
          </div>
        </div>
      ) : null}
      {analysis.outcome === 'bad_photo' ? (
        <div className="callout safety">
          <h2>Bad photo</h2>
          <p>{analysis.verdict}</p>
          <ul className="tips">{analysis.retake_tips.map((tip) => <li key={tip}>{tip}</li>)}</ul>
        </div>
      ) : null}
      {analysis.outcome === 'unknown' ? (
        <div className="callout">
          <h2>Not enough evidence</h2>
          <p>{analysis.verdict}</p>
          <ul className="tips">{analysis.retake_tips.map((tip) => <li key={tip}>{tip}</li>)}</ul>
        </div>
      ) : null}
      <div className="verdict-row">
        <GradeMark grade={analysis.grade ?? (analysis.outcome === 'bad_photo' ? '!' : '?')} label={analysis.grade_label} />
        <div>
          <p className="eyebrow">{analysis.board_type}</p>
          <h2>{analysis.outcome === 'candidates' ? analysis.verdict : analysis.summary}</h2>
          {analysis.outcome === 'candidates' ? <p className="fine">{analysis.summary}</p> : null}
        </div>
      </div>
      {analysis.outcome === 'candidates' ? (
        <details className="how-to-read">
          <summary>How to read this</summary>
          <p>
            {confirmed} confirmed, {parts.length - confirmed - rejected} unreviewed, {rejected} rejected.
          </p>
          <ul>
            {VALUE_ASSUMPTIONS.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </details>
      ) : null}
      <h3>{parts.length === 0 ? (analysis.outcome === 'candidates' ? 'Nothing in the active types' : 'No parts marked') : 'Hotspots'}</h3>
      {parts.length === 0 ? (
        <p className="empty">
          {analysis.outcome === 'candidates'
            ? 'No likely candidates match the switches that are on. Turn a type back on, or rescan if it was off when the photo was sent.'
            : 'GoldSpotter did not mark any parts in this photo. Follow the tips above and try another shot.'}
        </p>
      ) : (
        <ol className="part-list">
          {parts.map((part, index) => (
            <li key={part.id}>
              <button
                id={part.id}
                type="button"
                className={part.id === selected ? 'part is-selected' : 'part'}
                aria-pressed={part.id === selected}
                onClick={() => setSelected(part.id)}
              >
                <span className="swatch" style={{ background: metalColor(part) }}>{index + 1}</span>
                <span className="part-copy">
                  <strong>{part.label}</strong>
                  <span className="meta">
                    {candidateKind(part)} · {part.value_potential} value · {CONFIDENCE_LABELS[part.confidence]} confidence
                  </span>
                  {part.precious_metals.length > 0 ? (
                    <span className="chips">
                      {part.precious_metals.map((metal) => (
                        <em key={metal}>{METAL_LABELS[metal]}</em>
                      ))}
                    </span>
                  ) : null}
                  <span className="note">{part.note}</span>
                  {part.review !== 'unreviewed' ? <span className="meta">{part.review === 'confirmed' ? 'Confirmed on this device' : 'Rejected on this device'}</span> : null}
                </span>
              </button>
            </li>
          ))}
        </ol>
      )}
      {missed.length > 0 ? (
        <p className="hint">A type you just turned on was not sent with this photo. Scan again to look for it.</p>
      ) : null}
      <ScanTypeSwitches types={scanTypes} hint={typeHint} onToggle={onToggleType} />
      {analysis.outcome === 'candidates' ? (
        <>
          <h3>Recovery</h3>
          <ul className="tips recovery">
            {analysis.recovery_tips.map((tip) => (
              <li key={tip}>{tip}</li>
            ))}
          </ul>
        </>
      ) : null}
      <div className="actions">
        <button type="button" className="btn btn-primary" onClick={onShare} disabled={sharing}>
          {sharing ? 'Making the card…' : 'Share result card'}
        </button>
        <button type="button" className="btn btn-ghost" onClick={onAgain}>
          Scan another
        </button>
      </div>
      <p className="disclaimer">{analysis.disclaimer}</p>
      <p className="support-line">
        <CoffeeLink lead="If this saved you a bad pull," />
      </p>
    </section>
  );
}

function MetalTally({ parts }: { parts: Array<{ precious_metals: Array<keyof typeof METAL_LABELS>; count?: number }> }) {
  const counts = new Map<string, { label: string; color: string; n: number }>();
  for (const part of parts) {
    const metal = part.precious_metals[0];
    const key = metal ?? 'other';
    const entry = counts.get(key) ?? { label: metal ? METAL_LABELS[metal] : 'Other parts', color: metal ? METAL_COLORS[metal] : '#a39b8e', n: 0 };
    entry.n += 1;
    counts.set(key, entry);
  }
  return (
    <ul className="tally" aria-label="Hotspots by metal">
      {[...counts.values()].map((entry) => (
        <li key={entry.label}>
          <i style={{ background: entry.color }} />
          {entry.n} {entry.label}
        </li>
      ))}
    </ul>
  );
}

function candidateKind(part: { precious_metals: Array<keyof typeof METAL_LABELS> }): string {
  if (part.precious_metals.length === 0) return 'Not precious';
  if (part.precious_metals.includes('gold')) return 'Likely gold';
  return `Likely ${part.precious_metals.map((metal) => METAL_LABELS[metal]).join(' / ')} candidate`;
}
