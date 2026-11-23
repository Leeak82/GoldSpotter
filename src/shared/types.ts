export const GRADES = ['A', 'B', 'C', 'D'] as const;
export type Grade = (typeof GRADES)[number];

export const GOLD_LEVELS = ['high', 'medium', 'low', 'none'] as const;
export type GoldLevel = (typeof GOLD_LEVELS)[number];

export const PRECIOUS_METALS = ['gold', 'silver', 'palladium', 'platinum', 'tantalum'] as const;
export type PreciousMetal = (typeof PRECIOUS_METALS)[number];

export const COMPONENT_TYPES = [
  'cpu_processor',
  'ram_chip',
  'gold_fingers',
  'pin_connector',
  'ic_chip',
  'qfp_chip',
  'bga_chip',
  'soic_chip',
  'mlcc',
  'tantalum_capacitor',
  'relay',
  'crystal_oscillator',
  'gold_plated_pads',
  'plated_through_hole',
  'resistor',
  'inductor_diode',
  'other',
] as const;
export type ComponentType = (typeof COMPONENT_TYPES)[number];

export const CONFIDENCE_LEVELS = ['low', 'medium', 'high'] as const;
export type ConfidenceLevel = (typeof CONFIDENCE_LEVELS)[number];

export const VALUE_LEVELS = ['high', 'medium', 'low'] as const;
export type ValuePotential = (typeof VALUE_LEVELS)[number];

export const OUTCOMES = ['candidates', 'unknown', 'bad_photo'] as const;
export type Outcome = (typeof OUTCOMES)[number];

export const REVIEWS = ['unreviewed', 'confirmed', 'rejected'] as const;
export type ReviewState = (typeof REVIEWS)[number];

export type BBox = [number, number, number, number];

export type Component = {
  label: string;
  type: ComponentType;
  bbox: BBox;
  precious_metals: PreciousMetal[];
  gold_level: GoldLevel;
  value_potential: ValuePotential;
  confidence: ConfidenceLevel;
  /** Why this visible part was flagged. Likely-worded, not a confirmed find. */
  note: string;
  /** How many identical parts this box covers. 1 for a single part. */
  count?: number;
  /** Text printed on the part, such as 1R00 or 103, when readable. */
  marking?: string;
  /** Local only. The model does not set this. */
  review: ReviewState;
};

export type Analysis = {
  board_type: string;
  outcome: Outcome;
  grade: Grade | null;
  grade_label: string;
  verdict: string;
  summary: string;
  recovery_tips: string[];
  retake_tips: string[];
  components: Component[];
  disclaimer: string;
  provider?: 'gemini' | 'groq';
  model?: string;
};

export type AnalysisFailure = {
  ok: false;
  error: string;
};

export type AnalysisSuccess = {
  ok: true;
  value: Analysis;
};

export const GRADE_LABELS: Record<Grade, string> = {
  A: 'High grade',
  B: 'Medium grade',
  C: 'Light grade',
  D: 'Low grade',
};

export const TYPE_LABELS: Record<ComponentType, string> = {
  cpu_processor: 'CPU / processor',
  ram_chip: 'RAM chip',
  gold_fingers: 'Gold-finger edge connector',
  pin_connector: 'Pin connector',
  ic_chip: 'IC chip',
  qfp_chip: 'QFP chip',
  bga_chip: 'BGA chip',
  soic_chip: 'SOIC chip',
  mlcc: 'MLCC ceramic capacitor',
  tantalum_capacitor: 'Tantalum capacitor',
  relay: 'Relay contacts',
  crystal_oscillator: 'Crystal oscillator',
  gold_plated_pads: 'Gold-plated pads',
  plated_through_hole: 'Plated through-hole',
  resistor: 'SMD resistor',
  inductor_diode: 'Inductor / diode',
  other: 'Other part',
};

export const CONFIDENCE_LABELS: Record<ConfidenceLevel, 'Low' | 'Med' | 'High'> = {
  low: 'Low',
  medium: 'Med',
  high: 'High',
};

export const METAL_COLORS: Record<PreciousMetal, string> = {
  gold: '#f0c14b',
  silver: '#d5dbe3',
  palladium: '#6eb0c4',
  platinum: '#efeaf8',
  tantalum: '#d0894a',
};

export const METAL_LABELS: Record<PreciousMetal, string> = {
  gold: 'Gold',
  silver: 'Silver',
  palladium: 'Palladium',
  platinum: 'Platinum',
  tantalum: 'Tantalum',
};

export const APP_URL = 'https://goldspotter.onrender.com';

export const DISCLAIMER =
  'Educational read of a photo, not an assay. GoldSpotter can miss parts or mislabel them, and it does not estimate grams or dollars. Sell material to a reputable refiner and follow local e-waste rules. Do not refine with chemicals at home.';

export const SAFE_TIPS = [
  'Set aside the likely gold-bearing candidates you confirm and bag them apart from the leftover board.',
  'Sell sorted lots to a reputable refiner or a certified e-waste recycler. Prices move with the metal market and the size of the lot.',
  'Do not use acids or other chemical refining at home. GoldSpotter will not describe those processes.',
];

export const RETAKE_TIPS = [
  'Use even, neutral light and cut the glare.',
  'Wait until the board is in focus.',
  'Fit the whole board in the frame, then photograph the other side.',
  'Add a close-up of the connectors and any gold-colored fingers.',
];

export const VALUE_ASSUMPTIONS = [
  'Only a photo was read. Plating thickness and anything inside a chip were not measured.',
  'The letter is a sorting category buyers use, not a weight and not a dollar amount.',
  'Rejected boxes are ignored. Boxes you have not confirmed are still candidates.',
  'A refiner’s quote depends on the weight of the lot and the day’s metal prices.',
];
