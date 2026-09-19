// Production flow strip — real station nodes from Model 3 with utilization rings.

import { ArrowRight, AlertTriangle, Database, Box } from 'lucide-react'
import { fmtNum, fmtPct, statusOf } from '../utils/format'

const FLOW = ['BLANKING', 'PRESS1', 'PRESS2', 'PRESS3', 'PRESS4', 'CELL1', 'CELL2', 'CELL3', 'CELL4', 'PAINT1', 'PAINT2', 'QUALITY']

function utilColor(u) {
  if (u == null) return '#7d8bb0'
  if (u >= 95) return '#f4506c'
  if (u >= 85) return '#f5a623'
  if (u >= 70) return '#38d9f5'
  return '#34d399'
}

export function FlowStrip({ stations, bottleneckId, onSelect, compact = false }) {
  const byId = new Map((stations || []).map((s) => [s.id, s]))
  return (
    <div className="flex items-stretch gap-1.5 overflow-x-auto pb-1">
      <TerminalNode icon={<Database size={16} />} label="Raw Material" />
      {FLOW.map((id, i) => {
        const s = byId.get(id)
        if (!s) return null
        const isBk = bottleneckId === id
        const color = utilColor(s.utilization)
        return (
          <div key={id} className="flex items-center">
            <FlowArrow />
            <button
              onClick={() => onSelect?.(id)}
              className={`group flex shrink-0 flex-col items-center gap-1 rounded-xl border px-2.5 py-2 transition-all ${
                isBk ? 'border-red/60 bg-red/10 glow-red' : 'border-line2/70 bg-navy-800/60 hover:border-neon/50'
              }`}
              style={{ minWidth: compact ? 86 : 96 }}
            >
              <span className="relative grid h-11 w-11 place-items-center">
                <svg viewBox="0 0 44 44" className="absolute inset-0 -rotate-90">
                  <circle cx="22" cy="22" r="19" fill="none" stroke="#1c2444" strokeWidth="3" />
                  <circle
                    cx="22" cy="22" r="19" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round"
                    strokeDasharray={`${(s.utilization || 0) / 100 * 119.4} 119.4`}
                    style={{ transition: 'stroke-dasharray .8s ease' }}
                  />
                </svg>
                <span className="text-[10.5px] font-bold" style={{ color }}>
                  {s.utilization != null ? Math.round(s.utilization) : '—'}
                </span>
                {isBk && (
                  <span className="absolute -right-1 -top-1 grid h-4 w-4 place-items-center rounded-full bg-red text-navy-950">
                    <AlertTriangle size={9} strokeWidth={2.6} />
                  </span>
                )}
              </span>
              <span className="text-[10.5px] font-medium text-mist">{shortName(s.name)}</span>
              <span className="text-[9.5px] text-fog">
                {s.queue_mean != null ? `Q ${fmtNum(s.queue_mean, 0)}` : 'no queue field'}
              </span>
            </button>
          </div>
        )
      })}
      <FlowArrow />
      <TerminalNode icon={<Box size={16} />} label="Finished Goods" />
    </div>
  )
}

function shortName(n) {
  return n.replace('Assembly Cell', 'Cell').replace('Forklift Fleet', 'Forklift')
}

function FlowArrow() {
  return <ArrowRight size={13} className="mx-0.5 shrink-0 text-line2" />
}

function TerminalNode({ icon, label }) {
  return (
    <div className="flex shrink-0 flex-col items-center justify-center gap-1 rounded-xl border border-line bg-navy-850/80 px-3 py-3">
      <span className="grid h-9 w-9 place-items-center rounded-lg bg-navy-800 text-fog">{icon}</span>
      <span className="text-[10px] text-fog">{label}</span>
    </div>
  )
}
