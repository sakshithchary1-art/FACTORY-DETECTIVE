// ForgeSite UI primitives.

import { ArrowUpRight, ArrowDownRight } from 'lucide-react'
import { statusOf } from '../utils/format'

export function Panel({ title, icon, right, children, className = '', glow = false, pad = true }) {
  return (
    <section className={`glass ${glow ? 'glow-purple' : ''} ${className}`}>
      {(title || right) && (
        <header className="flex items-center justify-between gap-3 px-5 pt-4 pb-3">
          <div className="flex items-center gap-2.5 min-w-0">
            {icon && <span className="text-neon">{icon}</span>}
            <h3 className="font-semibold text-[15px] text-white truncate">{title}</h3>
          </div>
          <div className="flex items-center gap-2 shrink-0">{right}</div>
        </header>
      )}
      <div className={pad ? 'px-5 pb-5' : ''}>{children}</div>
    </section>
  )
}

export function KpiCard({ label, value, unit, sub, delta, deltaDown = false, tone = 'neon', icon, loading, onClick }) {
  const tones = {
    neon: 'text-neon', cyan: 'text-cyan', purple: 'text-purple',
    green: 'text-green', red: 'text-red', amber: 'text-amber',
  }
  const ringTones = {
    neon: 'bg-neon/15 text-neon', cyan: 'bg-cyan/15 text-cyan', purple: 'bg-purple/15 text-purple',
    green: 'bg-green/15 text-green', red: 'bg-red/15 text-red', amber: 'bg-amber/15 text-amber',
  }
  if (loading) {
    return (
      <div className="glass p-5">
        <div className="skeleton h-4 w-24" />
        <div className="skeleton h-9 w-36 mt-3" />
        <div className="skeleton h-3 w-28 mt-2" />
      </div>
    )
  }
  return (
    <div
      onClick={onClick}
      className={`glass glass-hover edge-top p-5 ${onClick ? 'cursor-pointer' : ''} group`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          {icon && (
            <span className={`grid h-8 w-8 place-items-center rounded-lg ${ringTones[tone]}`}>{icon}</span>
          )}
          <span className="text-[13px] text-mist">{label}</span>
        </div>
        {delta != null && (
          <span className={`flex items-center gap-1 text-xs font-medium ${deltaDown ? 'text-red' : 'text-green'}`}>
            {deltaDown ? <ArrowDownRight size={12} /> : <ArrowUpRight size={12} />}
            {delta}
          </span>
        )}
      </div>
      <div className="mt-3 flex items-baseline gap-2">
        <span className={`font-semibold text-[32px] leading-none tracking-tight ${tones[tone]}`}>{value}</span>
        {unit && <span className="text-xs text-fog">{unit}</span>}
      </div>
      {sub && <p className="mt-2 text-xs text-fog">{sub}</p>}
    </div>
  )
}

export function Chip({ label, tone = 'neon', className = '' }) {
  const tones = {
    neon: 'border-neon/40 text-neon bg-neon/10',
    cyan: 'border-cyan/40 text-cyan bg-cyan/10',
    purple: 'border-purple/40 text-purple bg-purple/10',
    green: 'border-green/40 text-green bg-green/10',
    red: 'border-red/40 text-red bg-red/10',
    amber: 'border-amber/40 text-amber bg-amber/10',
    fog: 'border-line2 text-fog bg-navy-800',
  }
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10.5px] font-medium tracking-wide ${tones[tone]} ${className}`}>
      {label}
    </span>
  )
}

export function StatusBadge({ status }) {
  const s = statusOf(status)
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10.5px] font-semibold tracking-wider ${s.border} ${s.text} ${s.bg}`}>
      <span className="h-1.5 w-1.5 rounded-full pulse-soft" style={{ background: s.dot }} />
      {status}
    </span>
  )
}

export function ViewDetails({ onClick, label = 'View Details' }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1 text-xs text-neon hover:text-cyan transition-colors"
    >
      {label} <ArrowUpRight size={13} />
    </button>
  )
}

export function EmptyState({ title, body, icon }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-line2 px-6 py-10 text-center">
      {icon && <div className="mb-3 text-fog">{icon}</div>}
      <p className="text-sm font-medium text-mist">{title}</p>
      {body && <p className="mt-1.5 max-w-md text-xs leading-relaxed text-fog">{body}</p>}
    </div>
  )
}

export function Skeleton({ className = 'h-40' }) {
  return <div className={`skeleton ${className}`} />
}

export function chartTooltipStyle() {
  return {
    background: 'rgba(11, 15, 31, 0.95)',
    border: '1px solid #293357',
    borderRadius: 10,
    fontSize: 12,
    color: '#dfe6f7',
    boxShadow: '0 8px 28px rgba(0,0,0,0.45)',
  }
}
