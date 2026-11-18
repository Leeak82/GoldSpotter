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
  const lines: string[] = ['Only mark groups that are enabled. Skip every disabled group, even if you notice it.'];
  if (types.includes('gold')) {
    lines.push(
      'Enabled — Gold: gold-finger edge connectors, gold-colored pin connectors, gold-plated pads, CPUs/processors, RAM chips, and IC/QFP/BGA packages that are likely gold-bearing. Put "gold" in precious_metals.',
    );
  }
  if (types.includes('silver')) {
    lines.push('Enabled — Silver: parts likely to carry silver, such as some relay contacts or silver-colored finishes. Put "silver" in precious_metals.');
  }
  if (types.includes('palladium')) {
    lines.push(
      'Enabled — Palladium: MLCC ceramic capacitors, which may use palladium or silver electrodes. Use type "mlcc". Do not call them gold-bearing.',
    );
  }
  if (types.includes('platinum')) {
    lines.push('Enabled — Platinum: only a part you can actually see that is a plausible platinum candidate. Put "platinum" in precious_metals. Leave it out if you are guessing.');
  }
  if (types.includes('tantalum')) {
    lines.push('Enabled — Tantalum capacitors: molded tantalum caps. Use type "tantalum_capacitor" and precious_metals ["tantalum"]. They are not gold.');
  }
  if (types.includes('all')) {
    lines.push(
      'Enabled — All components: also identify other visible parts (crystals, resistors, coils, plain connectors, unmarked chips) even when they are not precious. Use the closest type or "other", leave precious_metals empty when none apply, and say in why that it is a general parts ID, not a precious-metal candidate.',
    );
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
