import type { Component, ComponentType, PreciousMetal } from './types';

export const SCAN_TYPES = ['gold', 'silver', 'palladium', 'platinum', 'tantalum', 'all'] as const;
export type ScanType = (typeof SCAN_TYPES)[number];

export const SCAN_LABELS: Record<ScanType, { name: string; detail: string }> = {
  gold: { name: 'Gold', detail: 'Fingers, pins, pads, CPUs, ICs' },
  silver: { name: 'Silver', detail: 'Silver-bearing contacts and finishes' },
  palladium: { name: 'Palladium', detail: 'MLCC ceramic capacitors' },
  platinum: { name: 'Platinum', detail: 'Rare platinum-bearing parts' },
  tantalum: { name: 'Tantalum', detail: 'Tantalum capacitors' },
  all: { name: 'All components', detail: 'General parts ID, including non-precious parts' },
};

const GOLD_TYPES = new Set<ComponentType>([
  'gold_fingers',
  'gold_plated_pads',
  'cpu_processor',
  'ic_chip',
  'qfp_chip',
  'bga_chip',
  'soic_chip',
  'ram_chip',
]);

export function parseScanTypes(raw: unknown): ScanType[] {
  if (!Array.isArray(raw)) return [...SCAN_TYPES];
  return SCAN_TYPES.filter((type) => raw.includes(type));
}

export function toggleScanType(current: ScanType[], id: ScanType): { types: ScanType[]; blocked: boolean } {
  const next = current.includes(id) ? current.filter((type) => type !== id) : [...current, id];
  const ordered = SCAN_TYPES.filter((type) => next.includes(type));
  if (ordered.length === 0) return { types: orderedFrom(current), blocked: true };
  return { types: ordered, blocked: false };
}

export function scanSummary(types: ScanType[]): string {
  const names = orderedFrom(types).map((type) => SCAN_LABELS[type].name);
  return `Scanning: ${names.join(', ')}`;
}

export function detectionInstructions(types: ScanType[]): string {
  const lines: string[] = ['Only report part types for the groups that are on.'];
  if (types.includes('gold')) {
    lines.push(
      'On — Gold: gold_fingers, gold_plated_pads (exposed gold-finish pads and vias), pin_connector, cpu_processor, ram_chip, qfp_chip, bga_chip, soic_chip, ic_chip.',
    );
  }
  if (types.includes('silver')) lines.push('On — Silver: relay.');
  if (types.includes('palladium')) lines.push('On — Palladium: mlcc ceramic capacitors.');
  if (types.includes('platinum')) lines.push('On — Platinum: only a part you can clearly see that plausibly carries platinum, as type other.');
  if (types.includes('tantalum')) lines.push('On — Tantalum: tantalum_capacitor.');
  if (types.includes('all')) {
    lines.push('On — All components: also report resistor, inductor_diode, crystal_oscillator, plated_through_hole and other visible parts.');
  }
  const disabled = SCAN_TYPES.filter((type) => !types.includes(type)).map((type) => SCAN_LABELS[type].name);
  if (disabled.length > 0) lines.push(`Disabled, do not return these: ${disabled.join(', ')}.`);
  return lines.join('\n');
}

export function componentCategories(component: Pick<Component, 'type' | 'precious_metals'>): ScanType[] {
  const metals = new Set<PreciousMetal>(component.precious_metals);
  const categories: ScanType[] = [];
  if (GOLD_TYPES.has(component.type) || metals.has('gold') || (component.type === 'pin_connector' && (metals.has('gold') || metals.size === 0))) {
    categories.push('gold');
  }
  if (metals.has('silver')) categories.push('silver');
  if (component.type === 'mlcc' || metals.has('palladium')) categories.push('palladium');
  if (metals.has('platinum')) categories.push('platinum');
  if (component.type === 'tantalum_capacitor' || metals.has('tantalum')) categories.push('tantalum');
  if (metals.size === 0 || categories.length === 0) categories.push('all');
  return categories;
}

export function componentVisible(component: Pick<Component, 'type' | 'precious_metals'>, enabled: ScanType[]): boolean {
  const active = new Set(enabled);
  return componentCategories(component).some((category) => active.has(category));
}

function orderedFrom(types: ScanType[]): ScanType[] {
  const active = new Set(types);
  return SCAN_TYPES.filter((type) => active.has(type));
}
