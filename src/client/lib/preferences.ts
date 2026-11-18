import { SCAN_TYPES, toggleScanType, type ScanType } from '../../shared/scanTypes';

const KEY = 'goldspotter.scanTypes.v1';

export function loadScanTypes(): ScanType[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '');
    const parsed = SCAN_TYPES.filter((type) => Array.isArray(raw) && raw.includes(type));
    return parsed.length > 0 ? parsed : [...SCAN_TYPES];
  } catch {
    return [...SCAN_TYPES];
  }
}

export function storeScanTypes(types: ScanType[]): void {
  localStorage.setItem(KEY, JSON.stringify(types));
}

export function changeScanType(current: ScanType[], id: ScanType): { types: ScanType[]; blocked: boolean } {
  const result = toggleScanType(current, id);
  if (!result.blocked) storeScanTypes(result.types);
  return result;
}
