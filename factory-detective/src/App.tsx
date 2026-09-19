// Factory Detective — application shell.

import { useEffect, useState } from 'react'
import { Toasts } from './components/Toasts'
import { TopBar } from './components/TopBar'
import { AIBrief } from './pages/AIBrief'
import { Explorer } from './pages/Explorer'
import { Impact } from './pages/Impact'
import { Inspect } from './pages/Inspect'
import { Investigate } from './pages/Investigate'
import { Overview } from './pages/Overview'
import { Production } from './pages/Production'
import { Simulator } from './pages/Simulator'
import { useStore } from './store'

function PageBody() {
  const { page } = useStore()
  switch (page) {
    case 'overview': return <Overview />
    case 'inspect': return <Inspect />
    case 'investigate': return <Investigate />
    case 'production': return <Production />
    case 'impact': return <Impact />
    case 'simulator': return <Simulator />
    case 'brief': return <AIBrief />
    case 'explorer': return <Explorer />
    default: return <Overview />
  }
}

export default function App() {
  const { backendOnline, toast } = useStore()
  const [booted, setBooted] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setBooted(true), 350)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    if (backendOnline === false) {
      toast('error', 'Backend unreachable. Start it with: uvicorn main:app --reload (backend/ folder)')
    }
  }, [backendOnline, toast])

  return (
    <div className="bg-grid flex min-h-screen flex-col bg-void">
      <TopBar />
      <main
        className={`mx-auto w-full max-w-[1440px] flex-1 px-4 py-6 transition-opacity duration-300 md:px-6 ${
          booted ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <PageBody />
      </main>
      <footer className="border-t border-line px-4 py-3 md:px-6">
        <p className="mx-auto max-w-[1440px] font-mono text-[10px] leading-relaxed tracking-wide text-fog">
          FACTORY DETECTIVE — software-only decision-support prototype · NEURAX HACKATHON 3.0 ·
          Real data from the supplied discrete-event simulation dataset · Demo vision & case files
          are clearly labelled · Monetary figures are user-configured assumptions · Simulation is a
          prototype analytical estimate · No machine control / PLC integration.
        </p>
      </footer>
      <Toasts />
    </div>
  )
}
