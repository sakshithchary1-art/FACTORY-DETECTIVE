// FORGE SIGHT — operational feedback components.
//   <LoadingLine />      thin horizontal progress line
//   <CircularProgress /> thin engineering ring (reserved for key metrics)
//   <Term />             simple label with the technical term in a tooltip

import { useEffect, useState } from 'react'
import { Info } from 'lucide-react'

const LINE_STATUS = {
  loading: { bar: '#26364A', text: 'text-fog' },
  success: { bar: '#405443', text: 'text-green' },
  warning: { bar: '#A88952', text: 'text-amber' },
  error: { bar: '#6E3B42', text: 'text-red' },
}

export function LoadingLine({ label, percent, status = 'loading', showPercent = true, className = '' }) {
  const s = LINE_STATUS[status] || LINE_STATUS.loading
  const indeterminate = percent == null
  return (
    <div className={className}>
      {(label || showPercent) && (
        <div className="mb-1 flex items-center justify-between gap-3 text-[11px]">
          <span className={`truncate ${s.text}`}>{label}</span>
          {showPercent && !indeterminate && (
            <span className="font-mono text-fog tnum">{Math.round(percent)}%</span>
          )}
        </div>
      )}
      <div
        className="h-[3px] w-full overflow-hidden rounded-full bg-[#E8E2D6]"
        role="progressbar"
        aria-label={label || 'Loading'}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={indeterminate ? undefined : Math.round(percent)}
      >
        {indeterminate ? (
          <div className="loading-sweep h-full w-1/4 rounded-full" style={{ background: s.bar }} />
        ) : (
          <div
            className="h-full rounded-full transition-[width] duration-500 ease-out"
            style={{ width: `${Math.max(0, Math.min(100, percent))}%`, background: s.bar }}
          />
        )}
      </div>
    </div>
  )
}

const RING_STATUS = {
  normal: '#26364A',
  healthy: '#405443',
  success: '#405443',
  warning: '#A88952',
  critical: '#6E3B42',
  error: '#6E3B42',
}

// Thin engineering ring. Use only where a % genuinely communicates state.
export function CircularProgress({ value, label, subLabel, status = 'normal', size = 104, thickness = 5 }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    const t = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(t)
  }, [])

  const v = Math.max(0, Math.min(100, value ?? 0))
  const r = (size - thickness) / 2
  const C = 2 * Math.PI * r
  const color = RING_STATUS[status] || RING_STATUS.normal
  const offset = mounted ? C * (1 - v / 100) : C

  return (
    <div className="inline-flex flex-col items-center gap-1">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#E8E2D6" strokeWidth={thickness} />
          <circle
            cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={thickness}
            strokeLinecap="butt" strokeDasharray={C} strokeDashoffset={offset}
            style={{ transition: 'stroke-dashoffset 0.7s cubic-bezier(0.22, 1, 0.36, 1), stroke 0.3s' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="tnum font-semibold leading-none text-ink" style={{ fontSize: size * 0.2 }}>
            {Math.round(v)}<span className="text-[0.6em] text-fog">%</span>
          </span>
          {label && (
            <span className="mt-0.5 max-w-[86%] text-center text-[8px] font-semibold leading-tight tracking-[0.07em] text-fog uppercase">
              {label}
            </span>
          )}
        </div>
      </div>
      {subLabel && <span className="text-center text-[10px] leading-tight text-fog">{subLabel}</span>}
    </div>
  )
}

// Bare animated ring — callers overlay their own center content (%, label).
// Used by the production-flow strips where each station is a circular gauge.
export function MiniRing({ value, color = '#26364A', size = 48, thickness = 4, track = '#E8E2D6' }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    const t = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(t)
  }, [])
  const v = Math.max(0, Math.min(100, value ?? 0))
  const r = (size - thickness) / 2
  const C = 2 * Math.PI * r
  const offset = mounted ? C * (1 - v / 100) : C
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden="true">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={thickness} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={thickness}
        strokeLinecap="butt" strokeDasharray={C} strokeDashoffset={offset}
        style={{ transition: 'stroke-dashoffset 0.7s cubic-bezier(0.22, 1, 0.36, 1)' }}
      />
    </svg>
  )
}

// Simple label with the technical term exposed in a tooltip.
export function Term({ children, tech, className = '' }) {
  if (!tech) return <span className={className}>{children}</span>
  return (
    <span className={`inline-flex cursor-help items-center gap-0.5 border-b border-dotted border-line2 ${className}`} title={tech}>
      {children}
      <Info size={9} className="shrink-0 text-fog/60" aria-hidden="true" />
    </span>
  )
}
