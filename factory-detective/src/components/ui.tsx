// Reusable UI primitives for the command-center look.

import type { ReactNode } from 'react'
import type { DataTag } from '../lib/ui'
import { DATA_TAG_STYLES } from '../lib/ui'

export function DataTagBadge({ tag }: { tag: DataTag }) {
  return (
    <span
      className={`inline-flex items-center rounded-sm border px-1.5 py-0.5 font-mono text-[9.5px] tracking-[0.14em] ${DATA_TAG_STYLES[tag]}`}
    >
      {tag}
    </span>
  )
}

export function Panel({
  title, subtitle, right, tag, children, className = '', glow = false,
}: {
  title?: string
  subtitle?: string
  right?: ReactNode
  tag?: DataTag
  children: ReactNode
  className?: string
  glow?: boolean
}) {
  return (
    <section
      className={`rounded-md border border-line bg-panel/80 backdrop-blur-sm ${glow ? 'glow-ai' : ''} ${className}`}
    >
      {(title || right) && (
        <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5">
          <div className="min-w-0">
            {title && (
              <h3 className="truncate font-mono text-[11px] font-semibold tracking-[0.18em] text-mist">
                {title}
              </h3>
            )}
            {subtitle && <p className="mt-0.5 truncate text-[11px] text-fog">{subtitle}</p>}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {tag && <DataTagBadge tag={tag} />}
            {right}
          </div>
        </header>
      )}
      <div className="p-4">{children}</div>
    </section>
  )
}

export function MetricCard({
  label, value, unit, delta, deltaGoodWhenDown = false, sub, level, loading, icon,
}: {
  label: string
  value: string
  unit?: string
  delta?: string
  deltaGoodWhenDown?: boolean
  sub?: string
  level?: 'healthy' | 'watch' | 'high' | 'critical' | 'neutral'
  loading?: boolean
  icon?: ReactNode
}) {
  const levelText =
    level === 'critical' ? 'text-red-400' :
    level === 'high' ? 'text-amber-300' :
    level === 'watch' ? 'text-amber-400' :
    level === 'healthy' ? 'text-emerald-400' : 'text-white'

  let deltaCls = 'text-fog'
  if (delta) {
    const neg = delta.trim().startsWith('-')
    const good = deltaGoodWhenDown ? neg : !neg
    deltaCls = good ? 'text-emerald-400' : 'text-red-400'
  }

  if (loading) {
    return (
      <div className="rounded-md border border-line bg-panel/80 p-4">
        <div className="skeleton h-3 w-24 rounded" />
        <div className="skeleton mt-3 h-7 w-32 rounded" />
        <div className="skeleton mt-2 h-3 w-20 rounded" />
      </div>
    )
  }

  return (
    <div className="group rounded-md border border-line bg-panel/80 p-4 transition-colors hover:border-line2">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] tracking-[0.16em] text-fog">{label}</span>
        {icon && <span className="text-fog transition-colors group-hover:text-cyan">{icon}</span>}
      </div>
      <div className="mt-2 flex items-baseline gap-1.5">
        <span className={`font-mono text-2xl font-semibold tabular-nums ${levelText}`}>{value}</span>
        {unit && <span className="text-xs text-fog">{unit}</span>}
      </div>
      <div className="mt-1.5 flex items-center gap-2">
        {delta && <span className={`font-mono text-xs tabular-nums ${deltaCls}`}>{delta}</span>}
        {sub && <span className="truncate text-[11px] text-fog">{sub}</span>}
      </div>
    </div>
  )
}

export function Badge({
  children, tone = 'neutral', className = '',
}: {
  children: ReactNode
  tone?: 'neutral' | 'cyan' | 'amber' | 'red' | 'green' | 'violet'
  className?: string
}) {
  const tones = {
    neutral: 'border-line2 text-fog bg-panel2',
    cyan: 'border-cyan-500/40 text-cyan-300 bg-cyan-500/10',
    amber: 'border-amber-500/40 text-amber-300 bg-amber-500/10',
    red: 'border-red-500/40 text-red-400 bg-red-500/10',
    green: 'border-emerald-500/40 text-emerald-400 bg-emerald-500/10',
    violet: 'border-violet-500/40 text-violet-300 bg-violet-500/10',
  }
  return (
    <span className={`inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 font-mono text-[9.5px] tracking-[0.12em] ${tones[tone]} ${className}`}>
      {children}
    </span>
  )
}

export function Button({
  children, onClick, variant = 'default', disabled, className = '', title, type = 'button',
}: {
  children: ReactNode
  onClick?: () => void
  variant?: 'default' | 'primary' | 'danger' | 'ghost'
  disabled?: boolean
  className?: string
  title?: string
  type?: 'button' | 'submit'
}) {
  const variants = {
    default: 'border-line2 bg-panel2 text-mist hover:border-cyan-dim hover:text-white',
    primary: 'border-cyan-500/50 bg-cyan-500/15 text-cyan-200 hover:bg-cyan-500/25 hover:border-cyan-400 shadow-[0_0_14px_rgba(34,211,238,0.12)]',
    danger: 'border-red-500/50 bg-red-500/10 text-red-300 hover:bg-red-500/20',
    ghost: 'border-transparent bg-transparent text-fog hover:text-white hover:bg-panel2',
  }
  return (
    <button
      type={type}
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-md border px-3.5 py-2 font-mono text-[11px] font-semibold tracking-[0.12em] transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  )
}

export function SectionTitle({ children, hint }: { children: ReactNode; hint?: string }) {
  return (
    <div className="mb-3 flex items-center gap-3" title={hint}>
      <h2 className="font-mono text-xs font-bold tracking-[0.22em] text-white">{children}</h2>
      <div className="h-px flex-1 bg-gradient-to-r from-line2 to-transparent" />
    </div>
  )
}

export function EmptyState({
  icon, title, body, action,
}: {
  icon?: ReactNode
  title: string
  body?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-md border border-dashed border-line2 bg-panel/40 px-6 py-12 text-center">
      {icon && <div className="mb-3 text-fog">{icon}</div>}
      <p className="font-mono text-xs tracking-[0.16em] text-mist">{title}</p>
      {body && <p className="mt-2 max-w-md text-xs leading-relaxed text-fog">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function ConfidenceBar({ value, tone = 'cyan' }: { value: number; tone?: 'cyan' | 'amber' | 'red' | 'green' }) {
  const colors = {
    cyan: 'bg-cyan-400',
    amber: 'bg-amber-400',
    red: 'bg-red-400',
    green: 'bg-emerald-400',
  }
  return (
    <div className="h-1 w-full overflow-hidden rounded-full bg-line" title={`Confidence ${value}%`}>
      <div
        className={`h-full rounded-full transition-all duration-700 ${colors[tone]}`}
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  )
}

export function SkeletonBlock({ className = 'h-40' }: { className?: string }) {
  return <div className={`skeleton rounded-md ${className}`} />
}
