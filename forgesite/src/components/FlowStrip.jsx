// Production flow — engineering process diagram over real station data.
// Each station is a circular progress ring (machine usage, status-colored).
// An optional `flowProgress` prop (from /api/kpis → flow_progress) renders an
// overall flow-health ring with per-stage rings — never mislabelled as job
// completion.

import { ArrowRight } from 'lucide-react'
import { MiniRing } from './Feedback'
import { fmtNum, statusOf } from '../utils/format'

const FLOW = ['BLANKING', 'PRESS1', 'PRESS2', 'PRESS3', 'PRESS4', 'CELL1', 'CELL2', 'CELL3', 'CELL4', 'PAINT1', 'PAINT2', 'QUALITY']

function utilColor(u) {
  if (u == null) return '#8B8578'
  if (u >= 95) return '#6E3B42'
  if (u >= 85) return '#A6622B'
  if (u >= 70) return '#A88952'
  return '#405443'
}

function utilStatus(u) {
  if (u == null) return 'WATCH'
  if (u >= 95) return 'CRITICAL'
  if (u >= 85) return 'WARNING'
  if (u >= 70) return 'WATCH'
  return 'HEALTHY'
}

export function FlowStrip({ stations, bottleneckId, onSelect, compact = false, flowProgress = null }) {
  const byId = new Map((stations || []).map((s) => [s.id, s]))

  return (
    <div>
      <div className="flex items-stretch gap-1 overflow-x-auto pb-1">
        <TerminalNode label="Raw Material" />
        {FLOW.map((id) => {
          const s = byId.get(id)
          if (!s) return null
          const isBk = bottleneckId === id
          const u = s.utilization
          const color = utilColor(u)
          const st = statusOf(utilStatus(u))
          return (
            <div key={id} className="flex items-center">
              <ArrowRight size={11} className="mx-0.5 shrink-0 text-line2" />
              <button
                onClick={() => onSelect?.(id)}
                title={isBk ? 'Strongest production constraint' : s.name}
                className={`group flex w-[96px] shrink-0 flex-col items-center rounded-md border px-1.5 py-2 transition-colors ${
                  isBk ? 'border-red/50 bg-red/[0.04]' : 'border-line bg-white hover:border-line2'
                }`}
              >
                <div className="relative flex items-center justify-center">
                  <MiniRing value={u ?? 0} color={color} size={46} thickness={4} />
                  <span className="tnum absolute inset-0 flex items-center justify-center text-[11px] font-semibold" style={{ color }}>
                    {u != null ? `${Math.round(u)}%` : '—'}
                  </span>
                  {isBk && <span className="absolute -top-0.5 -right-0.5 h-[7px] w-[7px] rounded-full bg-red pulse-soft" title="Constraint" />}
                </div>
                <span className="mt-1.5 truncate text-[10px] font-semibold text-ink">{shortName(s.name)}</span>
                <span className={`truncate text-[8.5px] font-semibold tracking-wide uppercase ${st.text}`}>{st.label}</span>
                <span className="truncate text-[9px] text-fog">
                  {s.queue_mean != null ? `Waiting ${fmtNum(s.queue_mean, 0)}` : '—'}
                </span>
              </button>
            </div>
          )
        })}
        <ArrowRight size={11} className="mx-0.5 shrink-0 text-line2" />
        <TerminalNode label="Finished Goods" />
      </div>

      {flowProgress?.overall != null && (
        <div className="mt-3 border-t border-line pt-2.5">
          <div className="mb-1 flex items-baseline justify-between gap-3 text-[11px]">
            <span className="font-medium text-mist">Flow progressing normally</span>
            <span className="tnum font-mono font-semibold text-ink">{fmtNum(flowProgress.overall, 1)}%</span>
          </div>
          <div className="h-[5px] w-full overflow-hidden rounded-full bg-[#E8E2D6]">
            <div
              className="h-full rounded-full bg-navy transition-[width] duration-700 ease-out"
              style={{ width: `${flowProgress.overall}%` }}
            />
          </div>
          <p className="mt-1.5 text-[10px] leading-relaxed text-fog">
            Mean of per-stage flow health — congestion-free share and machine readiness.
            Not a job-completion percentage.
          </p>
        </div>
      )}
    </div>
  )
}

function shortName(n) {
  return n.replace('Assembly Cell', 'Cell').replace('Forklift Fleet', 'Forklift')
}

function TerminalNode({ label }) {
  return (
    <div className="flex w-[64px] shrink-0 flex-col items-center justify-center rounded-md border border-dashed border-line2 bg-navy-850 px-1.5 py-2.5">
      <span className="text-center text-[9.5px] leading-tight text-fog">{label}</span>
    </div>
  )
}
