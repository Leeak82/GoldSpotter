import {
  DISCLAIMER,
  GOLD_LEVELS,
  GRADE_LABELS,
  GRADES,
  OUTCOMES,
  PRECIOUS_METALS,
  RETAKE_TIPS,
  REVIEWS,
  SAFE_TIPS,
  VALUE_LEVELS,
  type Analysis,
  type AnalysisFailure,
  type AnalysisSuccess,
  type BBox,
  type Component,
  type ComponentType,
  type ConfidenceLevel,
  type GoldLevel,
  type Grade,
  type Outcome,
  type PreciousMetal,
  type ReviewState,
  type ValuePotential,
} from './types';

const MAX_COMPONENTS = 16;
const MIN_BOX = 0.012;

const TYPE_ALIASES: Record<string, ComponentType> = {
  'cpu processor': 'cpu_processor',
  'cpu soc': 'cpu_processor',
  cpu: 'cpu_processor',
  soc: 'cpu_processor',
  processor: 'cpu_processor',
  'ram chip': 'ram_chip',
  ram: 'ram_chip',
  'memory chip': 'ram_chip',
  'gold fingers': 'gold_fingers',
  'gold finger': 'gold_fingers',
  'edge connector': 'gold_fingers',
  'gold finger edge connector': 'gold_fingers',
  fingers: 'gold_fingers',
  'pin connector': 'pin_connector',
  'pin connectors': 'pin_connector',
  pins: 'pin_connector',
  connector: 'pin_connector',
  connectors: 'pin_connector',
  'ic chip': 'ic_chip',
  'bga ic': 'ic_chip',
  'bga ic chips': 'ic_chip',
  qfp: 'ic_chip',
  bga: 'ic_chip',
  ic: 'ic_chip',
  chip: 'ic_chip',
  chips: 'ic_chip',
  mlcc: 'mlcc',
  'mlcc capacitor': 'mlcc',
  'mlcc capacitors': 'mlcc',
  'mlcc ceramic capacitor': 'mlcc',
  'ceramic capacitor': 'mlcc',
  'tantalum capacitor': 'tantalum_capacitor',
  'tantalum capacitors': 'tantalum_capacitor',
  tantalum: 'tantalum_capacitor',
  relay: 'relay',
  relays: 'relay',
  'relay contacts': 'relay',
  'crystal oscillator': 'crystal_oscillator',
  crystal: 'crystal_oscillator',
  oscillator: 'crystal_oscillator',
  'gold plated pads': 'gold_plated_pads',
  'gold plated pad': 'gold_plated_pads',
  'gold pads': 'gold_plated_pads',
  pads: 'gold_plated_pads',
  'plated through hole': 'plated_through_hole',
  'plated through holes': 'plated_through_hole',
  pth: 'plated_through_hole',
  via: 'plated_through_hole',
  other: 'other',
};

/** Chemical refining language is stripped even if a model volunteers it. */
const UNSAFE =
  /aqua\s*regia|nitric|cyanide|\bNaCN\b|mercury|hydrochloric|muriatic|sulfuric|\bHNO3\b|\bHCl\b|bleach|hydrogen peroxide|electrolys|dissolve the|acid/i;

export function parseModelOutput(raw: string): unknown {
  let text = raw.trim();
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) text = fenced[1].trim();
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end <= start) {
    throw new Error('The model reply did not contain a JSON object.');
  }
  text = text.slice(start, end + 1);
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return JSON.parse(text.replace(/,\s*([}\]])/g, '$1')) as unknown;
  }
}

export function validateAnalysis(input: unknown): AnalysisSuccess | AnalysisFailure {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, error: 'Analysis was not a JSON object.' };
  }
  const record = input as Record<string, unknown>;
  if (record.components !== undefined && !Array.isArray(record.components)) {
    return { ok: false, error: 'Components list was missing.' };
  }

  const components: Component[] = [];
  const rawComponents = Array.isArray(record.components) ? record.components : [];
  for (const item of rawComponents) {
    if (components.length >= MAX_COMPONENTS) break;
    const component = normalizeComponent(item);
    if (component) components.push(component);
  }

  const outcome = normalizeOutcome(record.outcome, components.length);
  const grade = outcome === 'candidates' ? normalizeGrade(record.grade) : null;
  if (outcome === 'candidates' && !grade) return { ok: false, error: 'Grade must be A, B, C, or D.' };

  let verdict = soften(cleanText(record.verdict, 420));
  if (!verdict) return { ok: false, error: 'Verdict was empty.' };
  if (UNSAFE.test(verdict)) {
    verdict = 'Some parts may be worth sorting off this board. Sell them to a refiner, and do not chemically refine at home.';
  }

  const boardType = cleanText(record.board_type ?? record.boardType, 80) || 'Unknown board';
  const tips = normalizeTips(record.recovery_tips ?? record.recoveryTips);
  const retake = normalizeRetake(record.retake_tips ?? record.retakeTips, outcome);
  const summary = soften(cleanText(record.summary, 420)) || verdict;

  const value: Analysis = {
    board_type: boardType,
    outcome,
    grade,
    grade_label: grade ? GRADE_LABELS[grade] : outcome === 'bad_photo' ? 'Bad photo' : 'Not enough evidence',
    verdict,
    summary,
    recovery_tips: tips,
    retake_tips: retake,
    components,
    disclaimer: DISCLAIMER,
  };
  return { ok: true, value };
}

export function clampBBox(raw: unknown): BBox | null {
  const nums = bboxNumbers(raw);
  if (!nums) return null;
  let [x, y, w, h] = nums;
  const looksLikePercent = [x, y, w, h].some((n) => n > 1) && [x, y, w, h].every((n) => n <= 100 && n >= -2);
  if (looksLikePercent) {
    x /= 100;
    y /= 100;
    w /= 100;
    h /= 100;
  }
  x = clamp(x, 0, 1);
  y = clamp(y, 0, 1);
  w = clamp(w, 0, 1);
  h = clamp(h, 0, 1);
  if (x + w > 1) w = 1 - x;
  if (y + h > 1) h = 1 - y;
  if (w < MIN_BOX || h < MIN_BOX) return null;
  return [round4(x), round4(y), round4(w), round4(h)];
}

function normalizeComponent(item: unknown): Component | null {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
  const record = item as Record<string, unknown>;
  const label = soften(cleanText(record.label, 80));
  if (!label) return null;
  const bbox = clampBBox(record.bbox ?? record.box);
  if (!bbox) return null;
  const confidence = normalizeConfidence(record.confidence);
  if (!confidence) return null;
  const type = normalizeType(record.type);
  const goldLevel = normalizeGoldLevel(record.gold_level ?? record.goldLevel);
  let note = soften(cleanText(record.why ?? record.note, 280));
  if (!note) note = 'Visible part flagged as a likely candidate, not a confirmed find.';
  if (UNSAFE.test(note)) {
    note = 'Refining steps were removed. Sort this part and sell it to a refiner.';
  }
  return {
    label,
    type,
    bbox,
    precious_metals: normalizeMetals(record.precious_metals ?? record.preciousMetals),
    gold_level: goldLevel,
    value_potential: normalizeValue(record.value_potential ?? record.valuePotential, goldLevel, type),
    confidence,
    note,
    review: normalizeReview(record.review),
  };
}

function normalizeOutcome(raw: unknown, componentCount: number): Outcome {
  const text = cleanText(raw, 40).toLowerCase().replace(/[\s-]+/g, '_');
  if (text === 'bad_photo' || text === 'badphoto' || text === 'retake') return 'bad_photo';
  if (text === 'unknown' || text === 'insufficient' || text === 'insufficient_evidence' || text === 'not_enough_evidence') {
    return 'unknown';
  }
  if (OUTCOMES.includes(text as Outcome) || text === 'candidates') return 'candidates';
  return componentCount > 0 ? 'candidates' : 'unknown';
}

function normalizeReview(raw: unknown): ReviewState {
  const text = cleanText(raw, 20).toLowerCase();
  return REVIEWS.includes(text as ReviewState) ? (text as ReviewState) : 'unreviewed';
}

function normalizeRetake(raw: unknown, outcome: Outcome): string[] {
  const tips: string[] = [];
  if (Array.isArray(raw)) {
    for (const item of raw) {
      const text = soften(cleanText(item, 180));
      if (!text || UNSAFE.test(text)) continue;
      tips.push(text);
      if (tips.length >= 5) break;
    }
  }
  if (tips.length > 0) return tips;
  return outcome === 'candidates' ? [] : [...RETAKE_TIPS];
}

function soften(text: string): string {
  return text
    .replace(/gold\s+found/gi, 'likely gold-bearing candidate')
    .replace(/found\s+gold/gi, 'a likely gold-bearing candidate')
    .replace(/\$\s?\d[\d,]*(?:\.\d+)?/g, 'a refiner quote')
    .replace(/\b\d+(?:\.\d+)?\s?(?:grams|gram|ounces|ounce|oz)\b/gi, 'an unmeasured amount');
}

function normalizeTips(raw: unknown): string[] {
  const tips: string[] = [];
  if (Array.isArray(raw)) {
    for (const item of raw) {
      const text = cleanText(item, 220);
      if (!text || UNSAFE.test(text)) continue;
      tips.push(text);
      if (tips.length >= 6) break;
    }
  }
  return tips.length > 0 ? tips : [...SAFE_TIPS];
}

function normalizeGrade(raw: unknown): Grade | null {
  const text = cleanText(raw, 8).toUpperCase();
  return GRADES.includes(text as Grade) ? (text as Grade) : null;
}

function normalizeGoldLevel(raw: unknown): GoldLevel {
  const text = cleanText(raw, 16).toLowerCase();
  return GOLD_LEVELS.includes(text as GoldLevel) ? (text as GoldLevel) : 'none';
}

function normalizeType(raw: unknown): ComponentType {
  const text = cleanText(raw, 60)
    .toLowerCase()
    .replace(/[_/\-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return TYPE_ALIASES[text] ?? 'other';
}

function normalizeMetals(raw: unknown): PreciousMetal[] {
  if (!Array.isArray(raw)) return [];
  const found = new Set<PreciousMetal>();
  for (const item of raw) {
    const text = cleanText(item, 24).toLowerCase();
    if (PRECIOUS_METALS.includes(text as PreciousMetal)) found.add(text as PreciousMetal);
  }
  return PRECIOUS_METALS.filter((metal) => found.has(metal));
}

function bboxNumbers(raw: unknown): [number, number, number, number] | null {
  if (Array.isArray(raw) && raw.length >= 4) {
    const nums = raw.slice(0, 4).map(asNumber);
    if (nums.every((n): n is number => n !== null)) return nums as [number, number, number, number];
    return null;
  }
  if (raw && typeof raw === 'object') {
    const record = raw as Record<string, unknown>;
    const x = asNumber(record.x);
    const y = asNumber(record.y);
    const w = asNumber(record.w ?? record.width);
    const h = asNumber(record.h ?? record.height);
    if (x === null || y === null || w === null || h === null) return null;
    return [x, y, w, h];
  }
  return null;
}

function normalizeConfidence(raw: unknown): ConfidenceLevel | null {
  if (typeof raw === 'string') {
    const text = raw.trim().toLowerCase();
    if (text === 'low' || text === 'l') return 'low';
    if (text === 'med' || text === 'medium' || text === 'm') return 'medium';
    if (text === 'high' || text === 'h') return 'high';
  }
  const value = asNumber(raw);
  if (value === null) return null;
  const clamped = clamp(value, 0, 1);
  if (clamped < 0.45) return 'low';
  if (clamped < 0.75) return 'medium';
  return 'high';
}

function normalizeValue(raw: unknown, gold: GoldLevel, type: ComponentType): ValuePotential {
  const text = cleanText(raw, 16).toLowerCase();
  if (VALUE_LEVELS.includes(text as ValuePotential)) return text as ValuePotential;
  if (gold === 'high' || type === 'gold_fingers' || type === 'cpu_processor') return 'high';
  if (gold === 'medium' || type === 'ic_chip' || type === 'ram_chip' || type === 'pin_connector' || type === 'gold_plated_pads') {
    return 'medium';
  }
  return 'low';
}

function asNumber(raw: unknown): number | null {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (typeof raw === 'string' && raw.trim() && Number.isFinite(Number(raw))) return Number(raw);
  return null;
}

function cleanText(raw: unknown, max: number): string {
  if (typeof raw !== 'string') return '';
  return raw.replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round4(value: number): number {
  return Math.round(value * 10000) / 10000;
}
