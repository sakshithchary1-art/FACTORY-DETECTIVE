// DATA SOURCE transparency chip — shows the real dataset facts and method notes.

import { useState } from 'react'
import { Database, ChevronDown } from 'lucide-react'

export function DataSourceBar({ profile, mat, lastProcessed }) {
  const [open, setOpen] = useState(false)
  if (!profile?.available) return null
  return (
    <div className="glass px-4 py-2.5">
      <button onClick={() => setOpen((v) => !v)} className="flex w-full items-center gap-3 text-left">
        <Database size={14} className="text-cyan shrink-0" />
        <span className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-fog">
          <span>Dataset: <span className="text-mist">Model 3 (primary)</span></span>
          <span>Records: <span className="text-mist">{profile.rows.toLocaleString()}</span></span>
          <span>Fields: <span className="text-mist">{profile.n_columns}</span></span>
          <span className="hidden md:inline">MAT arrays: <span className="text-mist">{mat?.available ? mat.n_arrays : '—'}</span></span>
          <span>Last processed: <span className="text-mist">{lastProcessed}</span></span>
        </span>
        <ChevronDown size={14} className={`ml-auto text-fog transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="mt-3 grid gap-2 border-t border-line pt-3 text-[11px] leading-relaxed text-fog md:grid-cols-3">
          <p><span className="text-mist">DERIVED</span> — computed directly from the supplied CSV/MAT files by the Python engine. Source fields are named on every widget.</p>
          <p><span className="text-mist">SIMULATED / PROJECTED</span> — analytical scenario outputs (What-If Lab), clearly distinguished from measurements.</p>
          <p><span className="text-mist">PREDICTED</span> — model outputs validated on held-out data; metrics shown with the prediction or "Insufficient data".</p>
        </div>
      )}
    </div>
  )
}
