// FORGE SIGHT — application shell: boot screen, demo bar, header, pages.
// All pages are real; all data comes from the FastAPI backend over /api
// (proxied by Vite in dev).

import { useEffect, useState } from 'react'
import { useStore } from './store'
import { Sidebar, MobileNav } from './components/Sidebar'
import { Header } from './components/Header'
import { BootScreen } from './components/BootScreen'
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

// Simple-language demo steps (technical detail available on each page).
const DEMO_STEPS = [
  'Real image inspection', 'Production context', 'Factory status', 'Anomaly detected', 'Investigation',
  'Evidence + constraint', 'What-If Test', 'Test result', 'Business impact', 'AI Summary',
]

function DemoBar({ demoStep, demoActive, onExit }) {
  if (!demoActive) return null
  return (
    <div className="fixed inset-x-0 top-0 z-50 border-b border-purple/30 bg-white px-4 py-2 shadow-[0_2px_10px_rgba(124,58,237,0.10)]">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3">
        <span className="rounded-full bg-purple/10 px-2.5 py-1 text-[10px] font-bold tracking-widest text-purple">DEMO MODE</span>
        <div className="flex flex-1 flex-wrap items-center gap-1.5">
          {DEMO_STEPS.map((s, i) => (
            <span key={s} className={`rounded-md px-2 py-0.5 text-[10px] font-medium ${
              i < demoStep ? 'bg-purple/10 text-purple' : i === demoStep ? 'bg-neon/10 font-semibold text-neon' : 'text-fog'
            }`}>{String(i + 1).padStart(2, '0')} {s}</span>
          ))}
        </div>
        <button onClick={onExit} className="rounded-md border border-line2 px-2.5 py-1 text-[10px] font-semibold text-fog hover:text-ink">EXIT</button>
      </div>
    </div>
  )
}

export default function App() {
  const page = useStore((s) => s.page)
  const demoStep = useStore((s) => s.demoStep)
  const demoActive = useStore((s) => s.demoActive)
  // Application-startup gating: the boot screen belongs to the APP SHELL and
  // plays once per browser session (sessionStorage), never on tab/page changes.
  const [booting, setBooting] = useState(() => !sessionStorage.getItem('forgeSightLoaded'))
  const [backendOnline, setBackendOnline] = useState(null)
  const [profile, setProfile] = useState(null)
  const [mat, setMat] = useState(null)

  useEffect(() => {
    api.health().then(() => setBackendOnline(true)).catch(() => setBackendOnline(false))
    api.profile(3).then(setProfile).catch(() => setProfile(null))
    api.matInventory().then(setMat).catch(() => setMat(null))
  }, [])

  const finishBoot = () => {
    sessionStorage.setItem('forgeSightLoaded', 'true')
    setBooting(false)
  }

  const Page = PAGES[page] || Overview

  if (booting) return <BootScreen onDone={finishBoot} />

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
          FORGE SIGHT · AI-powered manufacturing intelligence — "See the problem. Find the cause."
          Software-only decision-support prototype. DERIVED values are computed from the supplied
          discrete-event simulation dataset; PROJECTED values are What-If Test scenarios; PREDICTED
          values come from a model validated on held-out data. No machine control, no fabricated metrics.
        </footer>
      </main>
      <Toasts />
    </div>
  )
}
