export function ErrorView({ message, onRetry, onUpload }: { message: string; onRetry: () => void; onUpload: (file: File) => void }) {
  const title = /overloaded right now/i.test(message)
    ? 'AI is busy'
    : /not configured|API key|GEMINI|GROQ/i.test(message)
    ? 'Scanner is not configured'
    : /too many/i.test(message)
      ? 'Too many scans'
      : /timed out|timeout/i.test(message)
        ? 'That read timed out'
        : 'Could not read this photo';
  return (
    <section className="error-card rise">
      <p className="eyebrow">Scan stopped</p>
      <h2>{title}</h2>
      <p>{message}</p>
      <div className="actions">
        <button type="button" className="btn btn-primary" onClick={onRetry}>
          Try the camera again
        </button>
        <label className="btn btn-ghost">
          Upload a different photo
          <input
            type="file"
            accept="image/*"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.currentTarget.value = '';
              if (file) onUpload(file);
            }}
          />
        </label>
      </div>
    </section>
  );
}
