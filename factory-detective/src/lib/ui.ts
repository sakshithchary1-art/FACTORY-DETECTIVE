// Shared UI helpers — formatting + semantic colors.

export const fmtInt = (x: number | null | undefined, fallback = '—') =>
  x == null || Number.isNaN(x) ? fallback : Math.round(x).toLocaleString('en-US')

export const fmtNum = (x: number | null | undefined, digits = 1, fallback = '—') =>
  x == null || Number.isNaN(x) ? fallback : x.toLocaleString('en-US', {
    minimumFractionDigits: digits, maximumFractionDigits: digits,
  })

export const fmtMoneyShort = (x: number | null | undefined, fallback = '—') => {
  if (x == null || Number.isNaN(x)) return fallback
  if (Math.abs(x) >= 1e7) return `₹${(x / 1e7).toFixed(2)} Cr`
  if (Math.abs(x) >= 1e5) return `₹${(x / 1e5).toFixed(1)} L`
  return `₹${Math.round(x).toLocaleString('en-IN')}`
}

export const fmtMoney = (x: number | null | undefined, fallback = '—') =>
  x == null || Number.isNaN(x) ? fallback : `₹${Math.round(x).toLocaleString('en-IN')}`

export const fmtPct = (x: number | null | undefined, digits = 1, fallback = '—') =>
  x == null || Number.isNaN(x) ? fallback : `${x.toFixed(digits)}%`

export const fmtSigned = (x: number | null | undefined, digits = 1, suffix = '%') => {
  if (x == null || Number.isNaN(x)) return '—'
  const s = x >= 0 ? '+' : ''
  return `${s}${x.toFixed(digits)}${suffix}`
}

export type UtilLevel = 'healthy' | 'watch' | 'high' | 'critical'

export function utilLevel(utilPct: number | null | undefined): UtilLevel {
  if (utilPct == null) return 'healthy'
  if (utilPct > 95) return 'critical'
  if (utilPct > 85) return 'high'
  if (utilPct >= 70) return 'watch'
  return 'healthy'
}

export const LEVEL_COLORS: Record<UtilLevel, { text: string; bg: string; border: string; dot: string; label: string }> = {
  healthy: { text: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', dot: '#34d399', label: 'HEALTHY' },
  watch: { text: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30', dot: '#f59e0b', label: 'WATCH' },
  high: { text: 'text-amber-300', bg: 'bg-amber-500/15', border: 'border-amber-400/40', dot: '#fbbf24', label: 'HIGH' },
  critical: { text: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/40', dot: '#ef4444', label: 'BOTTLENECK RISK' },
}

export const SEVERITY_META: Record<string, { text: string; bg: string; border: string; label: string }> = {
  critical: { text: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/40', label: 'CRITICAL' },
  high: { text: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/40', label: 'HIGH' },
  medium: { text: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30', label: 'MEDIUM' },
  watch: { text: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30', label: 'WATCH' },
  low: { text: 'text-cyan-300', bg: 'bg-cyan-500/10', border: 'border-cyan-500/30', label: 'LOW' },
  info: { text: 'text-cyan-300', bg: 'bg-cyan-500/10', border: 'border-cyan-500/30', label: 'INFO' },
  normal: { text: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', label: 'NORMAL' },
  none: { text: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', label: 'NO DEFECT' },
  unknown: { text: 'text-fog', bg: 'bg-slate-500/10', border: 'border-slate-500/30', label: 'PENDING' },
}

/** Shows which data-honesty class a panel belongs to. */
export type DataTag = 'REAL DATA' | 'DEMO DATA' | 'USER ASSUMPTIONS' | 'PROTOTYPE SIMULATION' | 'AI-GENERATED SUMMARY' | 'EVALUATION PENDING'

export const DATA_TAG_STYLES: Record<DataTag, string> = {
  'REAL DATA': 'border-emerald-500/40 text-emerald-400 bg-emerald-500/5',
  'DEMO DATA': 'border-cyan-500/40 text-cyan-300 bg-cyan-500/5',
  'USER ASSUMPTIONS': 'border-amber-500/40 text-amber-300 bg-amber-500/5',
  'PROTOTYPE SIMULATION': 'border-violet-500/40 text-violet-300 bg-violet-500/5',
  'AI-GENERATED SUMMARY': 'border-cyan-400/50 text-cyan-200 bg-cyan-400/10',
  'EVALUATION PENDING': 'border-slate-500/40 text-fog bg-slate-500/5',
}
