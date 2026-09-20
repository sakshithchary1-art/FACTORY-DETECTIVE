// Forge SIGHT API client — all analytics come from the FastAPI backend.

const BASE = ''

// Small in-memory cache for GET requests so returning to a tab renders its
// content INSTANTLY instead of re-fetching on every mount. Pages remount on
// navigation; with the cache their data resolves immediately and no loading
// state is ever shown. POSTs (simulations, predictions) are never cached.
// All analytics are computed from one fixed dataset, so cached values stay
// valid; entries older than TTL are returned immediately and refreshed in
// the background (stale-while-revalidate).
const CACHE_TTL_MS = 20000
const cache = new Map() // url -> { at, data }

function cachedJson(url) {
  const hit = cache.get(url)
  if (!hit) return null
  if (Date.now() - hit.at < CACHE_TTL_MS) return Promise.resolve(hit.data)
  // stale: serve instantly, refresh quietly in the background
  req(url.slice(BASE.length)).then((fresh) => cache.set(url, { at: Date.now(), data: fresh })).catch(() => {})
  return Promise.resolve(hit.data)
}

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
    throw new ApiError('Backend unreachable — start the Forge SIGHT API server (uvicorn main:app).', 0)
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

async function getJson(path) {
  const hit = cachedJson(BASE + path)
  if (hit) return hit
  const data = await req(path)
  cache.set(BASE + path, { at: Date.now(), data })
  return data
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

  profile: (m) => getJson(`/api/profile/${m}`),
  matInventory: () => getJson('/api/mat/inventory'),

  kpis: () => getJson('/api/kpis'),
  factoryHealth: () => getJson('/api/health/factory'),

  stations: () => getJson('/api/stations'),
  stationDetail: (id) => getJson(`/api/station/${id}`),

  bottlenecks: (weights) => req('/api/bottlenecks', {
    method: 'POST', body: JSON.stringify({ weights: weights || {} }),
  }),

  anomalies: (metric, method) => getJson(`/api/anomalies${qs({ metric, method })}`),

  correlationMatrix: (m = 3, maxVars = 10) => getJson(`/api/correlation/matrix${qs({ model_id: m, max_vars: maxVars })}`),
  correlationDetail: (m, a, b, method = 'pearson', lag = 0) =>
    getJson(`/api/correlation/detail${qs({ model_id: m, a, b, method, lag })}`),
  topRelationships: (m = 3, limit = 12) => getJson(`/api/correlation/top${qs({ model_id: m, limit })}`),

  series: (m, col, maxPoints = 300) => getJson(`/api/series${qs({ model_id: m, col, max_points: maxPoints })}`),
  histogram: (m, col, bins = 24) => getJson(`/api/histogram${qs({ model_id: m, col, bins })}`),

  simulate: (body) => req('/api/simulate', { method: 'POST', body: JSON.stringify(body) }),
  impact: (body) => req('/api/impact', { method: 'POST', body: JSON.stringify(body) }),

  modelStatus: () => req('/api/model/status'),
  predict: (body) => req('/api/predict', { method: 'POST', body: JSON.stringify(body) }),

  investigation: () => getJson('/api/investigation'),
  ask: (question) => req('/api/ask', { method: 'POST', body: JSON.stringify({ question }) }),
  report: () => getJson('/api/report'),
  vision: (image_base64) => req('/api/vision', { method: 'POST', body: JSON.stringify({ image_base64 }) }),

  // ---- Image dataset (real supplied images) ----
  imageSummary: () => getJson('/api/images/summary'),
  imageClasses: () => getJson('/api/images/classes'),
  images: (params) => getJson(`/api/images${qs(params)}`),
  imageDetail: (id) => getJson(`/api/images/${id}`),
  imageThumbnailUrl: (id) => `/api/images/${id}/thumbnail`,
  imageFileUrl: (id) => `/api/images/${id}/file`,
  imagePrediction: (id) => getJson(`/api/images/${id}/prediction`),
  imageProductionContext: (id) => getJson(`/api/images/${id}/production-context`),
  imageInvestigation: (id) => getJson(`/api/investigation/${id}`),
  visionModelStatus: () => getJson('/api/vision/model-status'),
  visionTrain: (maxPerClass = 300) => req('/api/vision/train', { method: 'POST', body: JSON.stringify({ max_per_class: maxPerClass }) }),
  imageAnalyze: (image_base64) => req('/api/images/analyze', { method: 'POST', body: JSON.stringify({ image_base64 }) }),
}
