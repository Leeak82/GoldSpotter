import { componentVisible, type ScanType } from '../../shared/scanTypes';
import {
  CONFIDENCE_LABELS,
  METAL_COLORS,
  type Component,
  type ConfidenceLevel,
  type PreciousMetal,
} from '../../shared/types';

export type MarkedPart = Component & { id: string };

const METAL_PRIORITY: PreciousMetal[] = ['gold', 'platinum', 'palladium', 'silver', 'tantalum'];

export function markParts(components: Component[]): MarkedPart[] {
  return components.map((component, index) => ({ ...component, id: `part-${index}` }));
}

export function visibleParts(components: Component[], enabled: ScanType[]): MarkedPart[] {
  // The server already returns parts in a fixed value order; keep it so numbers match every time.
  return markParts(components).filter((part) => componentVisible(part, enabled));
}

export function primaryMetal(part: Pick<Component, 'precious_metals'>): PreciousMetal | null {
  return METAL_PRIORITY.find((metal) => part.precious_metals.includes(metal)) ?? null;
}

export function metalColor(part: Pick<Component, 'precious_metals'>): string {
  const metal = primaryMetal(part);
  return metal ? METAL_COLORS[metal] : '#a39b8e';
}

export function confidenceText(level: ConfidenceLevel): 'Low' | 'Med' | 'High' {
  return CONFIDENCE_LABELS[level];
}
