import { SCAN_LABELS, SCAN_TYPES, scanSummary, type ScanType } from '../../shared/scanTypes';

export function ScanTypeSwitches({
  types,
  hint,
  onToggle,
}: {
  types: ScanType[];
  hint: string | null;
  onToggle: (id: ScanType) => void;
}) {
  return (
    <fieldset className="scan-types">
      <legend>{scanSummary(types)}</legend>
      <ul>
        {SCAN_TYPES.map((id) => {
          const on = types.includes(id);
          return (
            <li key={id}>
              <label className={on ? 'switch is-on' : 'switch'}>
                <input type="checkbox" checked={on} onChange={() => onToggle(id)} />
                <span>
                  <strong>{SCAN_LABELS[id].name}</strong>
                  <small>{SCAN_LABELS[id].detail}</small>
                </span>
              </label>
            </li>
          );
        })}
      </ul>
      {hint ? <p className="hint">{hint}</p> : null}
    </fieldset>
  );
}
