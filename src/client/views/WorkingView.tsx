import { useEffect, useState } from 'react';
import { BoardStage } from '../components/BoardStage';
import { workingCopy } from '../lib/working';

export function WorkingView({ imageUrl, onCancel, note }: { imageUrl: string | null; onCancel: () => void; note?: string | null }) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const started = Date.now();
    const timer = window.setInterval(() => setSeconds(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const copy = workingCopy(seconds, note);
  const progress = Math.min(0.95, seconds / 60);
  return (
    <section className="working rise">
      {imageUrl ? <BoardStage src={imageUrl} parts={[]} scanning /> : <div className="stage is-scanning placeholder" />}
      <div className="scan-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}>
        <span style={{ width: `${Math.round(progress * 100)}%` }} />
      </div>
      <p className="eyebrow" aria-live="polite">{copy.eyebrow}</p>
      <h2>{copy.title}</h2>
      <button type="button" className="btn btn-ghost" onClick={onCancel}>
        Cancel
      </button>
    </section>
  );
}
