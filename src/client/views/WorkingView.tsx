import { BoardStage } from '../components/BoardStage';

export function WorkingView({ imageUrl, onCancel }: { imageUrl: string | null; onCancel: () => void }) {
  return (
    <section className="working rise">
      {imageUrl ? <BoardStage src={imageUrl} parts={[]} scanning /> : <div className="stage is-scanning placeholder" />}
      <p className="eyebrow">Reading the board</p>
      <h2>Looking for fingers, chips, and connectors.</h2>
      <p className="lede">The photo is resized on your phone, then sent for a single read. Nothing is stored on the server.</p>
      <button type="button" className="btn btn-ghost" onClick={onCancel}>
        Cancel
      </button>
    </section>
  );
}
