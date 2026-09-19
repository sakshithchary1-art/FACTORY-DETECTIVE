// Top command bar — brand, investigation nav, plant status, demo runner.

import { useEffect, useState } from 'react'
import {
  Activity, BrainCircuit, Factory, LayoutDashboard, Microscope, Play,
  Search, Spline, Table2, Wallet, Wand2, X,
} from 'lucide-react'
import { api } from '../api'
import { useStore } from '../store'
import type { PageId } from '../types'
import { runDemo } from '../demo'

const NAV: { id: PageId; label: string; icon: typeof Search }[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'inspect', label: 'Inspect', icon: Microscope },
  { id: 'investigate', label: 'Investigate', icon: Search },
  { id: 'production', label: 'Production', icon: Spline },
  { id: 'impact', label: 'Impact', icon: Wallet },
  { id: 'simulator', label: 'Simulator', icon: Wand2 },
  { id: 'brief', label: 'AI Brief', icon: BrainCircuit },
  { id: 'explorer', label: 'Data', icon: Table2 },
]

export function TopBar() {
  const { page, navigate, backendOnline, inspection, demoActive, demoStep, toast } = useStore()
  const [aiReady, setAiReady] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    api.health()
      .then((h) => {
        if (!alive) return
        useStore.getState().setBackendOnline(true)
        setAiReady(h.ai?.llm_configured ? `LLM · ${h.ai.model}` : 'LOCAL ENGINE')
      })
      .catch(() => {
        if (!alive) return
        useStore.getState().setBackendOnline(false)
        setAiReady('OFFLINE')
      })
    return () => { alive = false }
  }, [])

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-ink/92 backdrop-blur-md">
      {/* status strip */}
      <div className="flex h-8 items-center justify-between border-b border-line/70 px-4 font-mono text-[10px] tracking-[0.14em]">
        <div className="flex items-center gap-5 text-fog">
          <span className="flex items-center gap-1.5">
            <span
              className={`pulse-dot h-1.5 w-1.5 rounded-full ${backendOnline === false ? 'bg-red-500' : 'bg-emerald-400'}`}
            />
            PLANT STATUS: <span className={backendOnline === false ? 'text-red-400' : 'text-emerald-400'}>
              {backendOnline === false ? 'DEGRADED' : 'ONLINE'}
            </span>
          </span>
          <span className="hidden md:inline">DATASET: MANUFACTURING SIMULATION</span>
          <span className="hidden lg:inline text-cyan-300/80">
            ACTIVE INVESTIGATION: {inspection.batch} / STATION {stationShort(inspection.station)}
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span className="hidden md:inline">
            AI STATUS:{' '}
            <span className={aiReady === 'OFFLINE' ? 'text-red-400' : 'text-cyan-300'}>
              {aiReady ?? '…'}
            </span>
          </span>
          <span className="text-fog">v1.0</span>
        </div>
      </div>

      {/* main bar */}
      <div className="flex h-14 items-center gap-4 px-4">
        <button
          onClick={() => navigate('overview')}
          className="flex items-center gap-2.5 text-left"
          title="Factory Detective — home"
        >
          <span className="grid h-8 w-8 place-items-center rounded-md border border-cyan-500/40 bg-cyan-500/10 shadow-[0_0_16px_rgba(34,211,238,0.22)]">
            <Factory size={16} className="text-cyan-300" />
          </span>
          <span>
            <span className="block font-mono text-[13px] font-bold tracking-[0.22em] text-white leading-none">
              FACTORY DETECTIVE
            </span>
            <span className="mt-0.5 block text-[10px] text-fog leading-none">
              from defect to the story behind it
            </span>
          </span>
        </button>

        <nav className="ml-2 hidden flex-1 items-center gap-0.5 xl:flex">
          {NAV.map((n) => {
            const active = page === n.id
            const Icon = n.icon
            return (
              <button
                key={n.id}
                onClick={() => navigate(n.id)}
                className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12px] transition-colors ${
                  active ? 'bg-cyan-500/12 text-cyan-200 border border-cyan-500/30' : 'text-fog hover:bg-panel2 hover:text-mist border border-transparent'
                }`}
              >
                <Icon size={13} />
                {n.label}
              </button>
            )
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {demoActive && (
            <span className="hidden items-center gap-1.5 rounded-sm border border-cyan-500/40 bg-cyan-500/10 px-2 py-1 font-mono text-[10px] tracking-[0.14em] text-cyan-300 sm:flex">
              <Activity size={11} className="pulse-dot" />
              DEMO · STEP {demoStep + 1}/6
            </span>
          )}
          <button
            onClick={async () => {
              try {
                await runDemo()
              } catch (e) {
                toast('error', e instanceof Error ? e.message : 'Demo failed to start')
              }
            }}
            disabled={demoActive}
            className="flex items-center gap-2 rounded-md border border-cyan-500/50 bg-cyan-500/15 px-3.5 py-2 font-mono text-[11px] font-semibold tracking-[0.12em] text-cyan-100 shadow-[0_0_18px_rgba(34,211,238,0.2)] transition-all hover:bg-cyan-500/25 active:scale-[0.98] disabled:opacity-50"
            title="One-click guided investigation (FD-017)"
          >
            <Play size={12} className="fill-cyan-200" />
            RUN DEMO INVESTIGATION
          </button>
          <MobileNav />
        </div>
      </div>
    </header>
  )
}

function stationShort(id: string) {
  // PRESS3 → 04 (demo narrative "Station 04" = Press 3)
  const map: Record<string, string> = {
    PRESS1: '01', PRESS2: '02', PRESS3: '04', PRESS4: '05',
    CELL1: '11', CELL2: '12', CELL3: '13', CELL4: '14',
  }
  return map[id] ?? id
}

function MobileNav() {
  const { page, navigate } = useStore()
  const [open, setOpen] = useState(false)
  return (
    <div className="xl:hidden relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="rounded-md border border-line2 bg-panel2 p-2 text-fog hover:text-white"
        title="Menu"
      >
        {open ? <X size={15} /> : <Activity size={15} />}
      </button>
      {open && (
        <div className="absolute right-0 top-11 z-50 w-52 rounded-md border border-line bg-panel shadow-2xl">
          {NAV.map((n) => {
            const Icon = n.icon
            return (
              <button
                key={n.id}
                onClick={() => { navigate(n.id); setOpen(false) }}
                className={`flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs ${
                  page === n.id ? 'bg-cyan-500/10 text-cyan-200' : 'text-fog hover:bg-panel2'
                }`}
              >
                <Icon size={13} /> {n.label}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
