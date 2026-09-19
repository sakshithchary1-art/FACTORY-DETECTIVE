// Formatting + status color helpers.

export const fmtInt = (x, fb = '—') =>
  x == null || Number.isNaN(Number(x)) ? fb : Math.round(x).toLocaleString('en-US')

export const fmtNum = (x, d = 1, fb = '—') =>
  x == null || Number.isNaN(Number(x)) ? fb : Number(x).toLocaleString('en-US', {
    minimumFractionDigits: d, maximumFractionDigits: d,
  })

export const fmtPct = (x, d = 1, fb = '—') =>
  x == null || Number.isNaN(Number(x)) ? fb : `${Number(x).toFixed(d)}%`

export const fmtSigned = (x, d = 1, suffix = '%') => {
  if (x == null || Number.isNaN(Number(x))) return '—'
  return `${x >= 0 ? '+' : ''}${Number(x).toFixed(d)}${suffix}`
}

export const fmtTime = (ts) => {
  const d = new Date(ts)
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
}

export const fmtDate = (ts) => {
  const d = new Date(ts)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

// status → colors (transparent thresholds come from the backend)
export const STATUS = {
  HEALTHY: { text: 'text-green', dot: '#34d399', ring: 'ring-green/40', bg: 'bg-green/10', border: 'border-green/40' },
  WATCH: { text: 'text-cyan', dot: '#38d9f5', ring: 'ring-cyan/40', bg: 'bg-cyan/10', border: 'border-cyan/40' },
  WARNING: { text: 'text-amber', dot: '#f5a623', ring: 'ring-amber/40', bg: 'bg-amber/10', border: 'border-amber/40' },
  CRITICAL: { text: 'text-red', dot: '#f4506c', ring: 'ring-red/40', bg: 'bg-red/10', border: 'border-red/40' },
}

export const statusOf = (s) => STATUS[s] || STATUS.WATCH

// label chips for data honesty
export const LABELS = {
  DERIVED: 'border-cyan/40 text-cyan bg-cyan/10',
  SIMULATED: 'border-purple/40 text-purple bg-purple/10',
  PROJECTED: 'border-purple/40 text-purple bg-purple/10',
  PREDICTED: 'border-neon/40 text-neon bg-neon/10',
  'USER-DEFINED': 'border-amber/40 text-amber bg-amber/10',
  METHODOLOGY: 'border-line2 text-fog bg-navy-800',
}
