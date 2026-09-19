// Factory Detective — typed API client with graceful failure handling.
// All requests go through the Vite dev proxy (/api → FastAPI :8000).

import type {
  AIStatus, Bottlenecks, Brief, CorrPair, CostImpact, DatasetInfo, FeatureTable,
  Health, Investigation, MatInfo, ModelSummary, ScatterData, Simulation,
  Station, VisionResult,
} from './types'

const BASE = ''

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  let resp: Response
  try {
    resp = await fetch(BASE + path, {
      headers: { 'Content-Type': 'application/json' },
      ...init,
    })
  } catch {
    throw new ApiError('Backend unreachable — is the API server running?', 0)
  }
  if (!resp.ok) {
    let detail = `Request failed (${resp.status})`
    try {
      const body = await resp.json()
      if (body?.detail) detail = String(body.detail)
    } catch { /* keep default */ }
    throw new ApiError(detail, resp.status)
  }
  return resp.json() as Promise<T>
}

function qs(params: Record<string, string | number | undefined>): string {
  const p = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') p.set(k, String(v))
  }
  const s = p.toString()
  return s ? `?${s}` : ''
}

// --------------------------------------------------------------------------- //

export const api = {
  health: () => req<Health>('/api/health'),

  datasets: () => req<{ root: string; datasets: DatasetInfo[]; mat: MatInfo }>('/api/datasets'),

  aiStatus: () => req<AIStatus>('/api/ai/status'),

  modelSummary: (m: 1 | 2 | 3) => req<ModelSummary>(`/api/model/${m}/summary`),

  modelFeatures: (m: 1 | 2 | 3, search = '', page = 1, pageSize = 25) =>
    req<FeatureTable>(`/api/model/${m}/features${qs({ search, page, page_size: pageSize })}`),

  modelCorrelations: (m: 1 | 2 | 3) =>
    req<{ available: boolean; model: number; pairs: CorrPair[] }>(`/api/model/${m}/correlations`),

  modelScatter: (m: 1 | 2 | 3, x: string, y: string, maxPoints = 1200) =>
    req<ScatterData>(`/api/model/${m}/scatter${qs({ x, y, max_points: maxPoints })}`),

  modelColumn: (m: 1 | 2 | 3, col: string) =>
    req<{ column: string; stats: FeatureTable['items'][0]['stats']; histogram: { bin: number; count: number }[] }>(
      `/api/model/${m}/column${qs({ col })}`),

  stations: () => req<{ stations: Station[] }>('/api/stations'),

  bottlenecks: (w?: { utilization: number; queue: number; wait: number }) =>
    req<Bottlenecks>(`/api/bottlenecks${w ? qs({ utilization: w.utilization, queue: w.queue, wait: w.wait }) : ''}`),

  investigation: (caseId = 'FD-017') => req<Investigation>(`/api/investigation${qs({ case_id: caseId })}`),

  costs: (body: {
    scrap_unit_cost: number; rework_unit_cost: number; downtime_hour_cost: number;
    contribution_margin: number; units_delta: number; case_id?: string
  }) => req<CostImpact>('/api/costs', { method: 'POST', body: JSON.stringify(body) }),

  simulate: (body: {
    station: string; cycle_adj_pct: number; extra_capacity: boolean;
    queue_reduction_pct: number; case_id?: string
  }) => req<Simulation>('/api/simulation', { method: 'POST', body: JSON.stringify(body) }),

  decisionBrief: (body: {
    case_id: string; station: string; simulation: Simulation; cost_impact: CostImpact
  }) => req<{ brief: Brief; ai_status: AIStatus }>('/api/decision-brief', {
    method: 'POST', body: JSON.stringify(body),
  }),

  exportBriefUrl: (caseId = 'FD-017') => `${BASE}/api/decision-brief/export?case_id=${encodeURIComponent(caseId)}`,

  visionDemos: () => req<{ demos: { id: string; label: string; severity: string; confidence: number; batch: string }[]; label: string }>(
    '/api/vision/demos'),

  visionDemo: (demoType: string) => req<VisionResult>('/api/vision-demo', {
    method: 'POST', body: JSON.stringify({ demo_type: demoType }),
  }),

  visionUpload: async (file: File): Promise<VisionResult> => {
    const fd = new FormData()
    fd.append('file', file)
    let resp: Response
    try {
      resp = await fetch(`${BASE}/api/vision/upload`, { method: 'POST', body: fd })
    } catch {
      throw new ApiError('Backend unreachable — is the API server running?', 0)
    }
    if (!resp.ok) {
      let detail = `Upload failed (${resp.status})`
      try {
        const body = await resp.json()
        if (body?.detail) detail = String(body.detail)
      } catch { /* keep default */ }
      throw new ApiError(detail, resp.status)
    }
    return resp.json() as Promise<VisionResult>
  },
}
