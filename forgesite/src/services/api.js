// ForgeSite API client — all analytics come from the FastAPI backend.

const BASE = ''

export class ApiError extends Error {
  constructor(message, status) {
    super(message)
    this.status = status
  }
}

async function req(path, init) {
  let resp
  try {
    resp = await fetch(BASE + path, {
      headers: { 'Content-Type': 'application/json' },
      ...init,
    })
  } catch {
    throw new ApiError('Backend unreachable — start the ForgeSite API server (uvicorn main:app, port 8010).', 0)
  }
  if (!resp.ok) {
    let detail = `Request failed (${resp.status})`
    try {
      const body = await resp.json()
      if (body?.detail) detail = String(body.detail)
    } catch { /* keep default */ }
    throw new ApiError(detail, resp.status)
  }
  return resp.json()
}

function qs(params) {
  const p = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') p.set(k, String(v))
  }
  const s = p.toString()
  return s ? `?${s}` : ''
}

export const api = {
  health: () => req('/api/health'),

  profile: (m) => req(`/api/profile/${m}`),
  matInventory: () => req('/api/mat/inventory'),

  kpis: () => req('/api/kpis'),
  factoryHealth: () => req('/api/health/factory'),

  stations: () => req('/api/stations'),
  stationDetail: (id) => req(`/api/station/${id}`),

  bottlenecks: (weights) => req('/api/bottlenecks', {
    method: 'POST', body: JSON.stringify({ weights: weights || {} }),
  }),

  anomalies: (metric, method) => req(`/api/anomalies${qs({ metric, method })}`),

  correlationMatrix: (m = 3, maxVars = 10) => req(`/api/correlation/matrix${qs({ model_id: m, max_vars: maxVars })}`),
  correlationDetail: (m, a, b, method = 'pearson', lag = 0) =>
    req(`/api/correlation/detail${qs({ model_id: m, a, b, method, lag })}`),
  topRelationships: (m = 3, limit = 12) => req(`/api/correlation/top${qs({ model_id: m, limit })}`),

  series: (m, col, maxPoints = 300) => req(`/api/series${qs({ model_id: m, col, max_points: maxPoints })}`),
  histogram: (m, col, bins = 24) => req(`/api/histogram${qs({ model_id: m, col, bins })}`),

  simulate: (body) => req('/api/simulate', { method: 'POST', body: JSON.stringify(body) }),
  impact: (body) => req('/api/impact', { method: 'POST', body: JSON.stringify(body) }),

  modelStatus: () => req('/api/model/status'),
  predict: (body) => req('/api/predict', { method: 'POST', body: JSON.stringify(body) }),

  investigation: () => req('/api/investigation'),
  ask: (question) => req('/api/ask', { method: 'POST', body: JSON.stringify({ question }) }),
  report: () => req('/api/report'),
  vision: (image_base64) => req('/api/vision', { method: 'POST', body: JSON.stringify({ image_base64 }) }),
}
