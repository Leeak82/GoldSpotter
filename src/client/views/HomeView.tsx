import type { ScanType } from '../../shared/scanTypes';
import { CameraGuide } from '../components/CameraGuide';
import { ScanTypeSwitches } from '../components/ScanTypeSwitches';

export function HomeView({
  types,
  typeHint,
  onToggleType,
  onScan,
  onUpload,
}: {
  types: ScanType[];
  typeHint: string | null;
  onToggleType: (id: ScanType) => void;
  onScan: () => void;
  onUpload: (file: File) => void;
}) {
  return (
    <section className="home rise">
      <p className="eyebrow">E-waste micro-scrap</p>
      <h1>See the gold on the board.</h1>
      <p className="lede">
        Snap a circuit board. GoldSpotter marks the parts that usually carry gold or other recoverable metals, then tells you if the pull is worth your time.
      </p>
      <div className="hero-card" aria-hidden="true">
        <div className="mini-board">
          <span className="finger" />
          <span className="chip" />
          <span className="chip tiny" />
          <span className="trace" />
        </div>
        <p>Boxes land on the parts, not the whole board.</p>
      </div>
      <ScanTypeSwitches types={types} hint={typeHint} onToggle={onToggleType} />
      <div className="actions">
        <button type="button" className="btn btn-primary" onClick={onScan}>
          Scan with camera
        </button>
        <label className="btn btn-ghost">
          Upload a photo
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
      <CameraGuide />
    </section>
  );
}
