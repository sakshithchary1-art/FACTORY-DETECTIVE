// ============================================================================
// Factory Detective — shared TypeScript types mirroring the FastAPI backend
// ============================================================================

export type Severity =
  | "critical" | "high" | "watch" | "normal"
  | "low" | "medium" | "none" | "info" | "unknown";

export interface Health {
  status: string;
  version: string;
  plant_status: string;
  datasets: Record<string, boolean>;
  ai: AIStatus;
  time: number;
}

export interface AIStatus {
  llm_configured: boolean;
  model: string | null;
  mode: "llm" | "local-deterministic";
  note: string;
}

export interface DatasetInfo {
  id: string;
  name: string;
  file: string;
  available: boolean;
  size_bytes: number | null;
}

export interface MatInfo {
  available: boolean;
  arrays?: Record<string, { shape: number[]; dtype: string; sample: number[] }>;
  error?: string;
}

export interface StatBlock {
  mean: number | null;
  std: number | null;
  min: number | null;
  p05: number | null;
  median: number | null;
  p95: number | null;
  max: number | null;
  count?: number;
}

export interface HistBin { bin: number; count: number }

export interface CorrPair { a: string; b: string; r: number | null; abs_r: number | null }

export interface Station {
  id: string;
  name: string;
  group: string;
  zone: string;
  util_col: string;
  queue_col: string | null;
  utilization: number | null;
  utilization_p95: number | null;
  queue_mean: number | null;
  queue_p95: number | null;
  queue_max: number | null;
  queue_hist: HistBin[];
  util_hist: HistBin[];
  bottleneck_score?: number;
  components?: { utilization_norm: number; queue_norm: number; wait_norm: number };
}

export interface Bottlenecks {
  available: boolean;
  weights: { utilization: number; queue: number; wait: number };
  label: string;
  stations: Station[];
  top: Station | null;
}

export interface Signal {
  id: number;
  title: string;
  detail: string;
  kind: "dataset_metric" | "dataset_correlation" | "demo_link";
  source: string;
  confidence: number;
  severity: Severity;
}

export interface Investigation {
  id: string;
  defect: string;
  batch: string;
  station: string;
  station_name: string;
  severity: Severity;
  confidence: number;
  location: string;
  demo: boolean;
  narrative: string;
  metrics: {
    utilization: number | null;
    utilization_p95: number | null;
    queue_mean: number | null;
    queue_p95: number | null;
    throughput_mean: number | null;
    wait_time_mean: number | null;
  };
  queue_pressure_percentile: number | null;
  correlation_evidence: { column: string; label: string; r_with_total_products: number | null }[];
  signals: Signal[];
  data_sources: { model: number; usage: string }[];
}

export interface SimState {
  throughput: number;
  utilization: number;
  queue: number;
  wait_time: number;
}

export interface Simulation {
  available: boolean;
  label: string;
  note: string;
  station: { id: string; name: string };
  controls: { cycle_adj_pct: number; extra_capacity: boolean; queue_reduction_pct: number };
  current: SimState;
  simulated: SimState;
  deltas: { throughput_pct: number; utilization_pct: number; queue_pct: number; wait_time_pct: number };
  business?: CostImpact;
  elasticity_used?: number;
  method: string;
  error?: string;
}

export interface CostImpact {
  label: string;
  currency: string;
  assumptions: {
    scrap_unit_cost: number;
    rework_unit_cost: number;
    downtime_hour_cost: number;
    contribution_margin: number;
  };
  quantities: {
    scrap_units: number;
    rework_units: number;
    downtime_hours: number;
    lost_units: number;
    gained_units: number;
  };
  breakdown: {
    scrap: number;
    rework: number;
    downtime: number;
    lost_output: number;
    recovered_margin_if_improved: number;
  };
  total_estimated_impact: number;
}

export interface Brief {
  problem: string;
  evidence: string[];
  possible_cause: string;
  production_impact: string;
  cost_impact: string;
  scenario: string;
  next_step: string;
  generator: string;
  ai_mode: string;
  engine: string;
}

export interface VisionResult {
  label: string;
  severity: Severity;
  confidence: number;
  location: string | null;
  box: { x: number; y: number; w: number; h: number } | null;
  batch: string;
  demo: boolean;
  uploaded?: boolean;
  label_tag: string;
  note: string;
}

export interface ModelSummary {
  model: number;
  available: boolean;
  rows: number;
  features: string[];
  n_features?: number;
  stats: Record<string, StatBlock>;
  histograms?: Record<string, HistBin[]>;
  groups?: Record<string, string[]>;
  kpi?: Record<string, number | null>;
  stations?: Station[];
}

export interface FeatureRow { name: string; stats: StatBlock }

export interface FeatureTable {
  available: boolean;
  total: number;
  page: number;
  page_size: number;
  items: FeatureRow[];
}

export interface ScatterData {
  available: boolean;
  x: string;
  y: string;
  r: number | null;
  points: { x: number; y: number }[];
}

// --------------------------------------------------------------------------- //
// Store-level UI types
// ---------------------------------------------------------------------------

export type PageId =
  | "overview" | "inspect" | "investigate" | "production"
  | "impact" | "simulator" | "brief" | "explorer";

export interface InspectionCase {
  demoType: string;          // vision demo id
  label: string;             // "Surface Crack"
  severity: Severity;
  confidence: number;
  location: string;
  station: string;           // backend station id, e.g. PRESS3
  batch: string;             // "B17"
  defectIsDefect: boolean;   // false for "Normal"
}

export interface Toast {
  id: number;
  kind: "info" | "success" | "warn" | "error";
  text: string;
}
