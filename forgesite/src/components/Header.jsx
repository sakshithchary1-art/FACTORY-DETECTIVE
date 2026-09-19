// Top header — live greeting, system status, real clock, demo launcher.

import { useEffect, useState } from 'react'
import { Play, Sparkles } from 'lucide-react'
import { useStore } from '../store'
import { greeting, fmtDate } from '../utils/format'
import { runDemo } from '../demo'

export function Header({ backendOnline }) {
  const { toast } = useStore()
  const demoActive = useStore((s) => s.demoActive)
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  return (
    <header className="flex flex-wrap items-center justify-between gap-3 pb-5">
      <div className="flex items-center gap-3">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-purple/20 text-purple glow-purple lg:hidden">
          <Sparkles size={16} />
        </span>
        <div>
          <h1 className="text-xl font-semibold text-white tracking-tight">
            {greeting()}, Engineer
          </h1>
          <p className="text-[13px] text-fog">Here's what's happening across your manufacturing system.</p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {!demoActive && (
          <button
            onClick={() => runDemo()}
            className="flex items-center gap-2 rounded-lg border border-purple/50 bg-purple/15 px-3.5 py-2 text-xs font-semibold text-purple transition-all hover:bg-purple/25 glow-purple"
            title="Guided 60–90s investigation walk over the real dataset"
          >
            <Play size={11} /> DEMO MODE
          </button>
        )}
        <span className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium ${
          backendOnline === false
            ? 'border-red/40 bg-red/10 text-red'
            : 'border-green/40 bg-green/10 text-green'
        }`}>
          <span className="h-1.5 w-1.5 rounded-full pulse-soft" style={{ background: backendOnline === false ? '#f4506c' : '#34d399' }} />
          {backendOnline === false ? 'SYSTEM OFFLINE' : 'SYSTEM ONLINE'}
        </span>
        <div className="hidden text-right sm:block">
          <p className="text-sm font-semibold text-white">
            {now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
          </p>
          <p className="text-[11px] text-fog">{fmtDate(now)}</p>
        </div>
        <button
          onClick={() => toast('info', 'ForgeSite Engineer — demo profile for the hackathon prototype.')}
          className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-neon to-purple text-xs font-bold text-white"
          title="Engineer profile"
        >
          MZ
        </button>
      </div>
    </header>
  )
}
