import type { HistoryItem } from '../lib/history';

export function HistoryView({
  items,
  onOpen,
  onDelete,
  onClear,
  onExport,
}: {
  items: HistoryItem[];
  onOpen: (item: HistoryItem) => void;
  onDelete: (id: string) => void;
  onClear: () => void;
  onExport: () => void;
}) {
  return (
    <section className="history rise">
      <div className="section-head">
        <div>
          <p className="eyebrow">On this device</p>
          <h1>Past scans</h1>
        </div>
        {items.length > 0 ? (
          <div className="history-actions">
            <button type="button" className="text-btn" onClick={onExport}>
              Export JSON
            </button>
            <button type="button" className="text-btn" onClick={onClear}>
              Clear history
            </button>
          </div>
        ) : null}
      </div>
      {items.length === 0 ? (
        <p className="empty">No scans yet. A photo you analyze is kept in this browser, not on the server.</p>
      ) : (
        <ul className="history-list">
          {items.map((item) => (
            <li key={item.id}>
              <button type="button" className="history-card" onClick={() => onOpen(item)}>
                <img src={item.imageDataUrl} alt="" />
                <span>
                  <strong>{item.analysis.grade ?? item.analysis.grade_label} · {item.analysis.board_type}</strong>
                  <span>{new Date(item.createdAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
                  <span className="note">{item.analysis.verdict}</span>
                </span>
              </button>
              <button type="button" className="text-btn danger" onClick={() => onDelete(item.id)} aria-label={`Delete ${item.analysis.board_type} scan`}>
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
