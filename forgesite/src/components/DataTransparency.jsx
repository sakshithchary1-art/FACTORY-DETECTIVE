// DATA SOURCE line — real dataset facts inline; method notes expand below.

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'

// Simplified names for the supplied models (technical names in tooltips)
export const MODEL_NAMES = {
  1: { simple: 'Factory Overview Data', tech: 'Model 1' },
  2: { simple: 'Production Flow Data', tech: 'Model 2' },
  3: { simple: 'Detailed Factory Data', tech: 'Model 3' },
}

export function DataSourceBar({ profile, mat, lastProcessed }) {
  const [open, setOpen] = useState(false)
  if (!profile?.available) return null
  return (
    <div className="border-b border-line pb-2.5">
      <button onClick={() => setOpen((v) => !v)} className="flex w-full items-center gap-3 text-left">
        <span className="flex flex-wrap items-center gap-x-5 gap-y-0.5 text-[11px] text-fog">
          <span>Source: <span className="font-medium text-mist">{MODEL_NAMES[3]?.simple || 'Model 3'}</span></span>
          <span className="tnum">Records: <span className="font-medium text-mist">{profile.rows.toLocaleString()}</span></span>
          <span className="tnum">Fields: <span className="font-medium text-mist">{profile.n_columns}</span></span>
          <span className="tnum hidden md:inline">Experiment arrays: <span className="font-medium text-mist">{mat?.available ? mat.n_arrays : '—'}</span></span>
          <span>Processed: <span className="font-medium text-mist">{lastProcessed}</span></span>
        </span>
        <ChevronDown size={13} className={`ml-auto shrink-0 text-fog transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="mt-2.5 grid gap-x-8 gap-y-1.5 border-t border-line pt-2.5 text-[11px] leading-relaxed text-fog md:grid-cols-3">
          <p><span className="font-semibold text-mist">DERIVED</span> — computed directly from the supplied CSV/MAT files. Source fields are named on every widget.</p>
          <p><span className="font-semibold text-mist">PROJECTED</span> — What-If Test scenario outputs, clearly distinguished from measurements.</p>
          <p><span className="font-semibold text-mist">PREDICTED</span> — model outputs validated on held-out data, or "Data unavailable".</p>
        </div>
      )}
    </div>
  )
}

// Data-picker buttons with technical names in tooltips. value = model id.
export function ModelPicker({ value, onChange, models = [3, 1, 2] }) {
  return (
    <div className="flex items-center gap-1">
      {models.map((m) => {
        const active = value === m
        const info = MODEL_NAMES[m] || { simple: `Model ${m}`, tech: `Model ${m}` }
        return (
          <button key={m} onClick={() => onChange(m)}
            title={`Technical name: ${info.tech}`}
            className={`rounded-md border px-2 py-1 text-[10.5px] font-medium transition-colors ${
              active ? 'border-neon/50 bg-neon/[0.06] text-neon' : 'border-line2 text-fog hover:text-mist'
            }`}>
            {info.simple}
          </button>
        )
      })}
    </div>
  )
}

export { Term } from './Feedback'
