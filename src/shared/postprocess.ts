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
  tinned_pads: { metals: [], gold: 'none', value: 'low', points: 0, cluster: true, plural: 'Tinned pads (HASL)', note: 'Silver-grey pads are tin solder (HASL), not gold.' },
  copper_pads: { metals: [], gold: 'none', value: 'low', points: 0, cluster: true, plural: 'Bare copper pads', note: 'Copper-coloured pads. Copper, not gold.' },
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

type Group = {
  type: ComponentType;
  bbox: BBox;
  count: number;
  confidence: ConfidenceLevel;
  markings: string[];
  finish?: Component['finish'];
  /** Overrides the type's metals: "other" may carry a model-named metal, tin-plated pins carry none. Null keeps the type's metals. */
  metals: PreciousMetal[] | null;
  note: string | null;
  review: Component['review'];
};

const GOLD_SURFACES = new Set<ComponentType>(['gold_plated_pads', 'gold_fingers']);

function tinnedPins(part: Component): boolean {
  return part.type === 'pin_connector' && (part.finish === 'silver' || part.finish === 'copper');
}

/**
 * Exposed metal is only called gold when the model saw a gold colour.
 * Silver-grey is tin (HASL), copper-coloured is bare copper. Pads of unclear colour are dropped;
 * edge fingers of unclear colour stay gold at low confidence because fingers are nearly always gold.
 * A missing finish counts as unclear, so the safeguard fails closed.
 */
export function applyFinish(part: Component): Component | null {
  if (!GOLD_SURFACES.has(part.type) || part.finish === 'gold') return part;
  if (part.finish === 'silver') return { ...part, type: 'tinned_pads' };
  if (part.finish === 'copper') return { ...part, type: 'copper_pads' };
  if (part.type === 'gold_fingers') return { ...part, confidence: 'low' };
  return null;
}

/**
 * A single chip box cannot hold more parts than fit along its long side. Caps the model's count
 * for non-cluster types (chips) using the photo's width/height ratio.
 */
export function capCount(part: Component, aspect: number): Component {
  const count = part.count ?? 1;
  if (count <= 1 || PART_RULES[part.type].cluster) return part;
  const w = part.bbox[2] * aspect;
  const h = part.bbox[3];
  const fit = Math.max(1, Math.floor(Math.max(w, h) / Math.max(1e-6, Math.min(w, h)) + 0.25));
  return fit >= count ? part : { ...part, count: fit };
}

function where(box: BBox): string {
  const cx = box[0] + box[2] / 2;
  const cy = box[1] + box[3] / 2;
  const vertical = cy < 0.4 ? 'top' : cy > 0.6 ? 'bottom' : '';
  const horizontal = cx < 0.4 ? 'left' : cx > 0.6 ? 'right' : '';
  return [vertical, horizontal].filter(Boolean).join(' ') || 'middle';
}

/** Two entries never share a title: repeats get a place word, then a number if still equal. */
export function disambiguateTitles(components: Component[]): Component[] {
  const totals = new Map<string, number>();
  for (const part of components) totals.set(part.label, (totals.get(part.label) ?? 0) + 1);
  const used = new Set<string>();
  return components.map((part) => {
    if ((totals.get(part.label) ?? 0) < 2) {
      used.add(part.label);
      return part;
    }
    let label = `${part.label} · ${where(part.bbox)}`;
    for (let n = 2; used.has(label); n += 1) label = `${part.label} · ${where(part.bbox)} ${n}`;
    used.add(label);
    return { ...part, label };
  });
}

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
      ...(part.finish ? { finish: part.finish } : {}),
      metals: part.type === 'other' && part.precious_metals.length > 0 ? [...part.precious_metals] : tinnedPins(part) ? [] : null,
      note: tinnedPins(part) ? 'Tin-plated pins. Not a gold source.' : null,
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
          if (a.type !== b.type || String(a.metals) !== String(b.metals)) continue;
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
  const names = [...new Set(gold.map((part) => PART_RULES[part.type].plural))].slice(0, 3);
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
export function finalizeAnalysis(analysis: Analysis, options: { aspect?: number } = {}): Analysis {
  if (analysis.outcome !== 'candidates') {
    return { ...analysis, components: [], grade: null };
  }
  const aspect = options.aspect && Number.isFinite(options.aspect) && options.aspect > 0 ? options.aspect : 1;
  const checked = analysis.components
    .map(applyFinish)
    .filter((part): part is Component => part !== null)
    .map((part) => capCount(part, aspect));
  const groups = mergeParts(checked);
  const components: Component[] = groups.map((group) => {
    const rule = PART_RULES[group.type];
    const marking = group.markings.length === 1 ? group.markings[0] : undefined;
    const metals = group.metals ?? rule.metals;
    return {
      label: partTitle(group.type, group.count, group.markings),
      type: group.type,
      bbox: group.bbox.map(round3) as BBox,
      precious_metals: [...metals],
      gold_level: metals.includes('gold') ? rule.gold : 'none',
      value_potential: metals.length === 0 && group.metals !== null ? 'low' : rule.value,
      confidence: group.confidence,
      note: group.note ?? (metals.includes('platinum') && group.type === 'other' ? 'Possible platinum-bearing part. Check it before sorting.' : rule.note),
      count: group.count,
      ...(marking ? { marking } : {}),
      ...(group.finish ? { finish: group.finish } : {}),
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
  const kept = disambiguateTitles(components.slice(0, MAX_PARTS));
  const grade = scoreGrade(kept);
  const { verdict, summary } = headline(kept);
  return { ...analysis, components: kept, grade, grade_label: GRADE_LABELS[grade], verdict, summary };
}
