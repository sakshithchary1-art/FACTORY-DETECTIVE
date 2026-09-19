// ForgeSite — application shell. All pages are real, all data comes from the
// FastAPI backend over /api (proxied by Vite in dev).

import { useEffect, useState } from 'react'
import { useStore } from './store'
import { Sidebar, MobileNav } from './components/Sidebar'
import { Header } from './components/Header'
import { DataSourceBar } from './components/DataTransparency'
import { Toasts } from './components/Toasts'
import { Overview } from './pages/Overview'
import { Inspect } from './pages/Inspect'
import { Investigate } from './pages/Investigate'
import { ProductionFlow } from './pages/ProductionFlow'
import { Simulate } from './pages/Simulate'
import { Reports } from './pages/Reports'
import { api } from './services/api'
import { runDemo, exitDemo } from './demo'

const PAGES = {
  overview: Overview,
  inspect: Inspect,
  investigate: Investigate,
  flow: ProductionFlow,
  simulate: Simulate,
  reports: Reports,
}

function DemoBar({ demoStep, demoActive, onExit }) {
  if (!demoActive) return null
  const steps = ['Overview', 'Anomaly', 'Investigation', 'Evidence', 'Bottleneck', 'Associations', 'What-If Lab', 'Simulation', 'Impact', 'Report']
  return (
    <div className="fixed inset-x-0 top-0 z-50 border-b border-purple/40 bg-navy-900/95 px-4 py-2 backdrop-blur glow-purple">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3">
        <span className="rounded-full bg-purple/20 px-2.5 py-1 text-[10px] font-bold tracking-widest text-purple">DEMO MODE</span>
        <div className="flex flex-1 flex-wrap items-center gap-1.5">
          {steps.map((s, i) => (
            <span key={s} className={`rounded-md px-2 py-0.5 text-[10px] font-medium ${
              i < demoStep ? 'bg-purple/15 text-purple' : i === demoStep ? 'bg-neon/20 text-cyan glow-neon' : 'text-fog'
            }`}>{String(i + 1).padStart(2, '0')} {s}</span>
          ))}
        </div>
        <button onClick={onExit} className="rounded-md border border-line2 px-2.5 py-1 text-[10px] font-semibold text-fog hover:text-white">EXIT</button>
      </div>
    </div>
  )
}

function DemoButton() {
  const demoActive = useStore((s) => s.demoActive)
  if (demoActive) return null
  return (
    <button
      onClick={() => runDemo()}
      className="flex items-center gap-2 rounded-lg border border-purple/50 bg-purple/15 px-3.5 py-2 text-xs font-semibold text-purple transition-all hover:bg-purple/25 glow-purple"
      title="Guided 60–90s investigation walk over the real dataset"
    >
      ▶ DEMO MODE
    </button>
  )
}

export default function App() {
  const page = useStore((s) => s.page)
  const demoStep = useStore((s) => s.demoStep)
  const demoActive = useStore((s) => s.demoActive)
  const setDemo = useStore((s) => s.setDemo)
  const [backendOnline, setBackendOnline] = useState(null)
  const [profile, setProfile] = useState(null)
  const [mat, setMat] = useState(null)

  useEffect(() => {
    api.health().then(() => setBackendOnline(true)).catch(() => setBackendOnline(false))
    api.profile(3).then(setProfile).catch(() => setProfile(null))
    api.matInventory().then(setMat).catch(() => setMat(null))
  }, [])

  const Page = PAGES[page] || Overview

  return (
    <div className={`min-h-screen ${demoActive ? 'pt-11' : ''}`}>
      <DemoBar demoStep={demoStep} demoActive={demoActive} onExit={exitDemo} />
      <Sidebar />
      <MobileNav />
      <main className="mx-auto w-full max-w-[1500px] px-4 pb-16 pt-6 sm:px-6 lg:ml-60 lg:w-[calc(100%-15rem)] lg:px-8">
        <Header backendOnline={backendOnline} />
        <div className="mb-5">
          <DataSourceBar profile={profile} mat={mat} lastProcessed={new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} />
        </div>
        <div key={page} className="fade-up">
          <Page />
        </div>
        <footer className="mt-10 border-t border-line pt-4 text-[10px] leading-relaxed text-fog">
          FORGESITE · AI Manufacturing Intelligence — "From factory data to actionable decisions."
          Software-only decision-support prototype. DERIVED values are computed from the supplied
          discrete-event simulation dataset; SIMULATED / PROJECTED values are analytical scenarios;
          PREDICTED values come from a model validated on held-out data. No machine control, no PLC
          integration, no fabricated metrics.
        </footer>
      </main>
      <Toasts />
    </div>
  )
}
