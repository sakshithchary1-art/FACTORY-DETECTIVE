// FORGE SIGHT formatting + status helpers.
// One source of truth for number presentation: short decimals, K/M compaction,
// four operational statuses only.

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

// compact large counts: 1,824 → 1.8K · 54,747 → 54.7K · 1,820,000 → 1.82M
export const fmtCompact = (x, fb = '—') => {
  if (x == null || Number.isNaN(Number(x))) return fb
  const n = Number(x)
  const abs = Math.abs(n)
  if (abs >= 1e6) return `${(n / 1e6).toFixed(2)}M`
  if (abs >= 1e4) return `${(n / 1e3).toFixed(1)}K`
  return Math.round(n).toLocaleString('en-US')
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

// Four operational statuses only — text + small indicator (heritage palette).
export const STATUS = {
  HEALTHY:  { text: 'text-green',  dot: '#405443', label: 'NORMAL' },
  WATCH:    { text: 'text-amber',  dot: '#A88952', label: 'WATCH' },
  WARNING:  { text: 'text-amber',  dot: '#a6622b', label: 'ATTENTION' },
  CRITICAL: { text: 'text-red',    dot: '#6E3B42', label: 'CRITICAL' },
}

export const statusOf = (s) => STATUS[s] || STATUS.WATCH

// label chips for data honesty
export const LABELS = {
  DERIVED: 'border-cyan/30 text-cyan bg-cyan/5',
  SIMULATED: 'border-purple/30 text-purple bg-purple/5',
  PROJECTED: 'border-purple/30 text-purple bg-purple/5',
  PREDICTED: 'border-neon/30 text-neon bg-neon/5',
  'USER-DEFINED': 'border-amber/30 text-amber bg-amber/5',
  METHODOLOGY: 'border-line2 text-fog bg-navy-850',
}
