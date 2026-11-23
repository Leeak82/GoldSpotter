import {
  COMPONENT_TYPES,
  GRADE_LABELS,
  TYPE_LABELS,
  type Analysis,
  type BBox,
  type Component,
  type ComponentType,
  type ConfidenceLevel,
  type GoldLevel,
  type Grade,
  type PreciousMetal,
  type ValuePotential,
} from './types';

/**
 * Fixed facts per part type. The model only says what a part is and where it sits;
 * the title, metals, value and wording come from here so they always agree and do not
 * drift between two scans of the same photo.
 */
type PartRule = {
  metals: PreciousMetal[];
  gold: GoldLevel;
  value: ValuePotential;
  /** Grade points for this type. Counted once per type, not once per box. */
  points: number;
  note: string;
  /** Neighbouring boxes of this type are merged into one cluster hotspot. */
  cluster: boolean;
  plural: string;
};

export const PART_RULES: Record<ComponentType, PartRule> = {
  gold_fingers: { metals: ['gold'], gold: 'high', value: 'high', points: 5, cluster: true, plural: 'Gold-finger edge connectors', note: 'Gold-plated edge contacts. The best gold source on most boards.' },
  cpu_processor: { metals: ['gold'], gold: 'high', value: 'high', points: 5, cluster: false, plural: 'CPUs / processors', note: 'Processor package. Gold bond wires and pads likely inside.' },
  gold_plated_pads: { metals: ['gold'], gold: 'medium', value: 'medium', points: 2, cluster: true, plural: 'Gold-plated pads', note: 'Exposed gold-finish (ENIG) pads and vias. Thin gold film over copper.' },
  bga_chip: { metals: ['gold'], gold: 'medium', value: 'medium', points: 2, cluster: false, plural: 'BGA chips', note: 'Ball-grid chip. Gold bond wires and substrate pads likely inside.' },
  ram_chip: { metals: ['gold'], gold: 'medium', value: 'medium', points: 2, cluster: false, plural: 'RAM chips', note: 'Memory chip. Gold bond wires likely inside.' },
  pin_connector: { metals: ['gold'], gold: 'medium', value: 'medium', points: 2, cluster: true, plural: 'Pin connectors', note: 'Connector pins. Contacts are often gold-flashed.' },
  qfp_chip: { metals: ['gold'], gold: 'low', value: 'medium', points: 1.5, cluster: false, plural: 'QFP chips', note: 'Leads on all four sides. Gold bond wires likely inside; the leads are tin-plated copper.' },
  ic_chip: { metals: ['gold'], gold: 'low', value: 'medium', points: 1, cluster: false, plural: 'IC chips', note: 'Chip package. Gold bond wires likely inside.' },
  soic_chip: { metals: ['gold'], gold: 'low', value: 'low', points: 0.5, cluster: false, plural: 'SOIC chips', note: 'Small chip with leads on two sides. A few fine bond wires inside.' },
  relay: { metals: ['silver'], gold: 'none', value: 'low', points: 0.5, cluster: false, plural: 'Relays', note: 'Relay contacts. Usually silver alloy, sometimes gold-flashed.' },
  mlcc: { metals: ['palladium'], gold: 'none', value: 'low', points: 0, cluster: true, plural: 'MLCC ceramic capacitors', note: 'Ceramic capacitor. Palladium or silver electrodes possible, not gold.' },
  tantalum_capacitor: { metals: ['tantalum'], gold: 'none', value: 'low', points: 0, cluster: true, plural: 'Tantalum capacitors', note: 'Molded tantalum capacitor. Tantalum, not gold.' },
  plated_through_hole: { metals: [], gold: 'none', value: 'low', points: 0, cluster: true, plural: 'Plated through-holes', note: 'Plated holes. Copper barrels, not a gold source.' },
  resistor: { metals: [], gold: 'none', value: 'low', points: 0, cluster: true, plural: 'SMD resistors', note: 'Thick-film resistor. Not a precious-metal source.' },
  inductor_diode: { metals: [], gold: 'none', value: 'low', points: 0, cluster: false, plural: 'Inductors / diodes', note: 'Molded power part. Copper and ferrite, not precious.' },
  crystal_oscillator: { metals: [], gold: 'none', value: 'low', points: 0, cluster: false, plural: 'Crystal oscillators', note: 'Metal-can crystal. Usually not precious.' },
  other: { metals: [], gold: 'none', value: 'low', points: 0, cluster: false, plural: 'Other parts', note: 'General parts ID, not a precious-metal candidate.' },
};

const MAX_PARTS = 10;
/** A cluster never grows past this share of the photo, so one box cannot swallow the board. */
const MAX_CLUSTER_AREA = 0.2;
const VALUE_RANK: Record<ValuePotential, number> = { high: 0, medium: 1, low: 2 };
const CONF_RANK: Record<ConfidenceLevel, number> = { high: 0, medium: 1, low: 2 };
const TYPE_RANK = new Map<ComponentType, number>(COMPONENT_TYPES.map((type, index) => [type, index]));

export function iou(a: BBox, b: BBox): number {
  const inter = intersection(a, b);
  const union = a[2] * a[3] + b[2] * b[3] - inter;
  return union > 0 ? inter / union : 0;
}

function intersection(a: BBox, b: BBox): number {
  const w = Math.min(a[0] + a[2], b[0] + b[2]) - Math.max(a[0], b[0]);
  const h = Math.min(a[1] + a[3], b[1] + b[3]) - Math.max(a[1], b[1]);
  return w > 0 && h > 0 ? w * h : 0;
}

function containment(a: BBox, b: BBox): number {
  const smaller = Math.min(a[2] * a[3], b[2] * b[3]);
  return smaller > 0 ? intersection(a, b) / smaller : 0;
}

/** Two boxes are neighbours when growing each by half its own size makes them touch. */
function neighbours(a: BBox, b: BBox): boolean {
  const grow = (box: BBox): BBox => [box[0] - box[2] / 2, box[1] - box[3] / 2, box[2] * 2, box[3] * 2];
  return intersection(grow(a), grow(b)) > 0;
}

function unionBox(a: BBox, b: BBox): BBox {
  const x = Math.min(a[0], b[0]);
  const y = Math.min(a[1], b[1]);
  const right = Math.max(a[0] + a[2], b[0] + b[2]);
  const bottom = Math.max(a[1] + a[3], b[1] + b[3]);
  return [x, y, right - x, bottom - y];
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function betterConfidence(a: ConfidenceLevel, b: ConfidenceLevel): ConfidenceLevel {
  return CONF_RANK[a] <= CONF_RANK[b] ? a : b;
}

type Group = { type: ComponentType; bbox: BBox; count: number; confidence: ConfidenceLevel; markings: string[]; review: Component['review'] };

/** Merges duplicate boxes (same type, overlapping) and clusters neighbouring small parts of one type. */
export function mergeParts(components: Component[]): Group[] {
  const sorted = [...components].sort((a, b) => a.bbox[1] - b.bbox[1] || a.bbox[0] - b.bbox[0]);
  const groups: Group[] = [];
  for (const part of sorted) {
    const group: Group = {
      type: part.type,
      bbox: part.bbox,
      count: Math.max(1, part.count ?? 1),
      confidence: part.confidence,
      markings: part.marking ? [part.marking] : [],
      review: part.review,
    };
    groups.push(group);
    // Keep folding until nothing else joins, so chains of neighbours end up in one cluster.
    let changed = true;
    while (changed) {
      changed = false;
      for (let i = groups.length - 1; i >= 0; i -= 1) {
        const a = groups[i];
        for (let j = 0; j < i; j += 1) {
          const b = groups[j];
          if (a.type !== b.type) continue;
          const duplicate = iou(a.bbox, b.bbox) > 0.3 || containment(a.bbox, b.bbox) > 0.7;
          const merged = unionBox(a.bbox, b.bbox);
          const cluster = PART_RULES[a.type].cluster && neighbours(a.bbox, b.bbox) && merged[2] * merged[3] <= MAX_CLUSTER_AREA;
          if (!duplicate && !cluster) continue;
          b.bbox = merged;
          b.count = duplicate ? Math.max(a.count, b.count) : a.count + b.count;
          b.confidence = betterConfidence(a.confidence, b.confidence);
          b.markings = [...new Set([...b.markings, ...a.markings])];
          groups.splice(i, 1);
          changed = true;
          break;
        }
        if (changed) break;
      }
    }
  }
  return groups;
}

export function partTitle(type: ComponentType, count: number, markings: string[]): string {
  const base = count > 1 ? `${PART_RULES[type].plural} ×${count}` : TYPE_LABELS[type];
  const mark = markings.length === 1 ? ` (${markings[0]})` : '';
  return `${base}${mark}`;
}

export function scoreGrade(components: Component[]): Grade {
  const seen = new Set<ComponentType>();
  let score = 0;
  for (const part of components) {
    if (part.review === 'rejected' || seen.has(part.type)) continue;
    seen.add(part.type);
    score += PART_RULES[part.type].points;
  }
  if (score >= 8) return 'A';
  if (score >= 5) return 'B';
  if (score >= 2) return 'C';
  return 'D';
}

/** Short, visual-first headline built from the parts list so the two always agree. */
export function headline(components: Component[]): { verdict: string; summary: string } {
  const gold = components.filter((part) => part.precious_metals.includes('gold'));
  if (components.length === 0) return { verdict: 'No parts marked', summary: 'Try a closer, sharper photo.' };
  if (gold.length === 0) return { verdict: 'No likely gold spots', summary: `${components.length} part${components.length === 1 ? '' : 's'} identified.` };
  const names = [...new Set(gold.map((part) => PART_RULES[part.type].plural.toLowerCase()))].slice(0, 3);
  return {
    verdict: `${gold.length} likely gold spot${gold.length === 1 ? '' : 's'}`,
    summary: `Best: ${names.join(', ')}.`,
  };
}

/**
 * Turns a validated model read into the final, deterministic result:
 * fixed titles and notes per type, merged duplicates, a stable sort,
 * and a grade and headline computed from the parts.
 */
export function finalizeAnalysis(analysis: Analysis): Analysis {
  if (analysis.outcome !== 'candidates') {
    return { ...analysis, components: [], grade: null };
  }
  const groups = mergeParts(analysis.components);
  const components: Component[] = groups.map((group) => {
    const rule = PART_RULES[group.type];
    const marking = group.markings.length === 1 ? group.markings[0] : undefined;
    return {
      label: partTitle(group.type, group.count, group.markings),
      type: group.type,
      bbox: group.bbox.map(round3) as BBox,
      precious_metals: [...rule.metals],
      gold_level: rule.gold,
      value_potential: rule.value,
      confidence: group.confidence,
      note: rule.note,
      count: group.count,
      ...(marking ? { marking } : {}),
      review: group.review,
    };
  });
  components.sort(
    (a, b) =>
      VALUE_RANK[a.value_potential] - VALUE_RANK[b.value_potential] ||
      PART_RULES[b.type].points - PART_RULES[a.type].points ||
      (TYPE_RANK.get(a.type) ?? 99) - (TYPE_RANK.get(b.type) ?? 99) ||
      a.bbox[1] - b.bbox[1] ||
      a.bbox[0] - b.bbox[0],
  );
  const kept = components.slice(0, MAX_PARTS);
  const grade = scoreGrade(kept);
  const { verdict, summary } = headline(kept);
  return { ...analysis, components: kept, grade, grade_label: GRADE_LABELS[grade], verdict, summary };
}
