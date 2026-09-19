// The signature Factory Detective pipeline strip.
// Shown near the top of the app; lights up as the judge walks the flow.

import { Check, CircleAlert } from 'lucide-react'
import { useStore } from '../store'
import type { PageId } from '../types'

const STAGES: { id: PageId; label: string }[] = [
  { id: 'inspect', label: 'DEFECT' },
  { id: 'investigate', label: 'CAUSE' },
  { id: 'production', label: 'BOTTLENECK' },
  { id: 'impact', label: 'COST' },
  { id: 'simulator', label: 'SIMULATION' },
  { id: 'brief', label: 'DECISION' },
]

const PAGE_TO_STAGE_INDEX: Partial<Record<PageId, number>> = {
  overview: -1,
  inspect: 0,
  investigate: 1,
  production: 2,
  impact: 3,
  simulator: 4,
  brief: 5,
  explorer: -1,
}

export function InvestigationPipeline({ compact = false }: { compact?: boolean }) {
  const { page, navigate, demoStep } = useStore()
  const current = PAGE_TO_STAGE_INDEX[page] ?? -1

  return (
    <nav aria-label="Investigation pipeline" className="flex items-center justify-center">
      <ol className="flex flex-wrap items-center justify-center gap-y-2">
        {STAGES.map((s, i) => {
          const reached = demoStep >= i || (demoStep < 0 && current >= i)
          const active = demoStep === i || (demoStep < 0 && current === i)
          const done = reached && !active
          return (
            <li key={s.id} className="flex items-center">
              <button
                onClick={() => navigate(s.id)}
                className={`group flex items-center gap-2 rounded-sm border px-2.5 py-1.5 font-mono text-[10px] tracking-[0.14em] transition-all ${
                  active
                    ? 'border-cyan-500/60 bg-cyan-500/15 text-cyan-200 shadow-[0_0_14px_rgba(34,211,238,0.18)]'
                    : done
                      ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-400/90'
                      : 'border-line bg-panel/60 text-fog hover:border-line2 hover:text-mist'
                } ${compact ? 'px-2 py-1' : ''}`}
                title={`Go to ${s.label}`}
              >
                <span
                  className={`grid h-4 w-4 place-items-center rounded-full border text-[8px] ${
                    active ? 'border-cyan-400 text-cyan-300' :
                    done ? 'border-emerald-500/60 text-emerald-400' : 'border-line2 text-fog'
                  }`}
                >
                  {done ? <Check size={9} strokeWidth={3} /> : active ? <span className="pulse-dot">●</span> : i + 1}
                </span>
                {s.label}
              </button>
              {i < STAGES.length - 1 && (
                <span
                  aria-hidden
                  className={`mx-1 block h-px w-4 md:w-7 ${reached ? 'bg-cyan-500/50' : 'bg-line2'}`}
                />
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

export function PipelineErrorStub({ msg }: { msg: string }) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-red-500/30 bg-red-500/5 px-3 py-2">
      <CircleAlert size={14} className="text-red-400" />
      <span className="font-mono text-[11px] text-red-300">{msg}</span>
    </div>
  )
}
