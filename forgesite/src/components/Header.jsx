// Top header — operational strip: plant identity, status, timestamp, action.

import { useEffect, useState } from 'react'
import { Play } from 'lucide-react'
import { useStore } from '../store'
import { greeting, fmtDate } from '../utils/format'
import { ForgeSightMark } from '../brand/ForgeSightLogo'
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
    <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b border-line pb-4">
      <div className="flex items-center gap-3">
        <span className="grid h-9 w-9 place-items-center rounded-lg border border-line bg-white lg:hidden">
          <ForgeSightMark size={19} />
        </span>
        <div>
          <h1 className="text-[17px] font-semibold leading-tight tracking-tight text-ink">
            {greeting()}, admin
          </h1>
          <p className="text-[11.5px] text-fog">Here's your current production overview.</p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {!demoActive && (
          <button
            onClick={() => runDemo()}
            className="btn-primary flex items-center gap-1.5 px-3 py-1.5 text-[11.5px] font-semibold"
            title="Guided 60–90s investigation walk over the real dataset"
          >
            <Play size={10} /> DEMO MODE
          </button>
        )}
        <span className={`flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.07em] ${
          backendOnline === false ? 'text-red' : 'text-green'
        }`}>
          <span
            className="h-[7px] w-[7px] rounded-full pulse-soft"
            style={{ background: backendOnline === false ? '#6E3B42' : '#405443' }}
          />
          {backendOnline === false ? 'SYSTEM OFFLINE' : 'SYSTEM ONLINE'}
        </span>
        <div className="hidden text-right leading-tight sm:block">
          <p className="tnum text-[13px] font-semibold text-ink">
            {now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
          </p>
          <p className="text-[10.5px] text-fog">{fmtDate(now)}</p>
        </div>
        <button
          onClick={() => toast('info', 'Forge SIGHT admin — demo profile for the hackathon prototype.')}
          className="grid h-8 w-8 place-items-center rounded-full bg-neon text-[11px] font-semibold text-white"
          title="Admin profile"
        >
          MZ
        </button>
      </div>
    </header>
  )
}
