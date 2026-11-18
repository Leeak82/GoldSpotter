import type { ScanType } from '../../shared/scanTypes';
import { ScanTypeSwitches } from '../components/ScanTypeSwitches';

export function SettingsView({
  types,
  hint,
  onToggle,
}: {
  types: ScanType[];
  hint: string | null;
  onToggle: (id: ScanType) => void;
}) {
  return (
    <section className="settings rise">
      <p className="eyebrow">Settings</p>
      <h1>What to look for</h1>
      <p className="lede">
        Switches default to on and stay in this browser. The next photo only asks for the types that are on. On a result you already have, turning one off hides those boxes without sending the photo again.
      </p>
      <ScanTypeSwitches types={types} hint={hint} onToggle={onToggle} />
    </section>
  );
}
