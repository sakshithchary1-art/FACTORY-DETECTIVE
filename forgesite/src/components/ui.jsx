// FORGE SIGHT UI primitives.
// Design rules: cards only where they group meaning; labels quiet, numbers
// dominant; consistent 8px-grid paddings; icons only where they add meaning.

import { ArrowUpRight } from 'lucide-react'
import { statusOf } from '../utils/format'

// Section header used OUTSIDE cards — hierarchy without extra chrome.
export function SectionTitle({ title, right, note }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-4">
      <div className="min-w-0">
        <h2 className="text-[15px] font-semibold tracking-tight text-ink">{title}</h2>
        {note && <p className="mt-0.5 text-[11.5px] text-fog">{note}</p>}
      </div>
      {right && <div className="flex shrink-0 items-center gap-2">{right}</div>}
    </div>
  )
}

// Panel = functional container with a quiet header. No icons by default.
export function Panel({ title, icon, right, children, className = '', glow = false, pad = true, flush = false }) {
  return (
    <section className={`glass ${glow ? 'glow-neon' : ''} ${className}`}>
      {(title || right) && (
        <header className={`flex items-center justify-between gap-3 border-b border-line px-4 pb-2.5 pt-3 ${flush ? 'mx-0' : ''}`}>
          <div className="flex min-w-0 items-center gap-2">
            {icon && <span className="text-fog">{icon}</span>}
            <h3 className="truncate text-[12.5px] font-semibold tracking-wide text-mist uppercase">{title}</h3>
          </div>
          <div className="flex shrink-0 items-center gap-2">{right}</div>
        </header>
      )}
      <div className={pad ? 'p-4' : ''}>{children}</div>
    </section>
  )
}

// KPI: quiet label, dominant number, subtle support line. No icon boxes.
export function KpiCard({ label, value, unit, sub, delta, deltaDown = false, tone = 'ink', loading, onClick }) {
  const tones = {
    ink: 'text-ink', neon: 'text-neon', cyan: 'text-cyan', purple: 'text-purple',
    green: 'text-green', red: 'text-red', amber: 'text-amber',
  }
  if (loading) {
    return (
      <div className="glass p-4">
        <div className="skeleton h-3 w-24" />
        <div className="skeleton mt-3 h-7 w-28" />
        <div className="skeleton mt-2 h-3 w-32" />
      </div>
    )
  }
  return (
    <div
      onClick={onClick}
      className={`glass p-4 ${onClick ? 'cursor-pointer transition-colors hover:border-line2' : ''}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-[10.5px] font-semibold tracking-[0.08em] text-fog uppercase">{label}</span>
        {delta != null && (
          <span className={`shrink-0 text-[11px] font-medium ${deltaDown ? 'text-red' : 'text-green'}`}>
            {deltaDown ? '↓' : '↑'} {delta}
          </span>
        )}
      </div>
      <div className="mt-2 flex items-baseline gap-1.5">
        <span className={`text-[26px] leading-none font-semibold tracking-tight tnum ${tones[tone]}`}>{value}</span>
        {unit && <span className="text-[11.5px] text-fog">{unit}</span>}
      </div>
      {sub && <p className="mt-1.5 truncate text-[11px] text-fog">{sub}</p>}
    </div>
  )
}

// Compact square tag for data-honesty labels (DERIVED / PROJECTED / …).
export function Chip({ label, tone = 'fog', className = '' }) {
  const tones = {
    neon: 'border-neon/25 text-neon',
    cyan: 'border-cyan/25 text-cyan',
    purple: 'border-purple/25 text-purple',
    green: 'border-green/25 text-green',
    red: 'border-red/25 text-red',
    amber: 'border-amber/25 text-amber',
    fog: 'border-line2 text-fog',
  }
  return (
    <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[9.5px] font-semibold tracking-[0.06em] ${tones[tone]} ${className}`}>
      {label}
    </span>
  )
}

// Status: small dot + uppercase word. No pill background.
export function StatusBadge({ status }) {
  const s = statusOf(status)
  return (
    <span className={`inline-flex items-center gap-1.5 text-[10.5px] font-semibold tracking-[0.07em] ${s.text}`}>
      <span className="h-1.5 w-1.5 rounded-full pulse-soft" style={{ background: s.dot }} />
      {s.label}
    </span>
  )
}

export function ViewDetails({ onClick, label = 'View Details' }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1 text-[11.5px] font-medium text-neon transition-colors hover:text-cyan"
    >
      {label} <ArrowUpRight size={12} />
    </button>
  )
}

export function EmptyState({ title, body, icon }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-line2 px-6 py-10 text-center">
      {icon && <div className="mb-3 text-fog">{icon}</div>}
      <p className="text-[13px] font-medium text-mist">{title}</p>
      {body && <p className="mt-1.5 max-w-md text-[11.5px] leading-relaxed text-fog">{body}</p>}
    </div>
  )
}

export function Skeleton({ className = 'h-40' }) {
  return <div className={`skeleton ${className}`} />
}

/* Shared Recharts styling — flat, thin, readable, heritage palette */
export const CHART = {
  grid: '#E8E2D6',
  axis: '#D8D2C8',
  tick: { fill: '#5F6670', fontSize: 10 },
  height: 220,
  series: { blue: '#26364A', cyan: '#A88952', purple: '#6E3B42', green: '#405443', amber: '#A6622B', red: '#6E3B42', gray: '#8B8578' },
}

export function chartTooltipStyle() {
  return {
    background: '#FCFBF8',
    border: '1px solid #D8D2C8',
    borderRadius: 8,
    fontSize: 12,
    color: '#252525',
    boxShadow: '0 4px 14px rgba(37, 37, 37, 0.08)',
    padding: '6px 10px',
  }
}
