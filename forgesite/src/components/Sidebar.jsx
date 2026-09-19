// ForgeSite sidebar — navigation + insight card with animated visualization.

import {
  Home, Search, ShieldCheck, GitBranch, FlaskConical, FileText, Sparkles, ArrowRight,
} from 'lucide-react'
import { useStore } from '../store'

const NAV = [
  { id: 'overview', label: 'Overview', icon: Home },
  { id: 'inspect', label: 'Inspect', icon: Search },
  { id: 'investigate', label: 'Investigate', icon: ShieldCheck },
  { id: 'flow', label: 'Production Flow', icon: GitBranch },
  { id: 'simulate', label: 'Simulate', icon: FlaskConical },
  { id: 'reports', label: 'Reports', icon: FileText },
]

export function Sidebar() {
  const { page, navigate, aiOpen, setAiOpen } = useStore()
  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-line bg-navy-900/85 backdrop-blur-md lg:flex">
      {/* brand */}
      <div className="flex items-center gap-3 px-5 pt-5 pb-6">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-neon to-purple glow-neon">
          <Sparkles size={18} className="text-white" />
        </div>
        <div>
          <p className="text-[17px] font-bold leading-tight text-white tracking-tight">ForgeSite</p>
          <p className="text-[10.5px] text-fog leading-tight">AI Manufacturing Intelligence</p>
        </div>
      </div>

      {/* nav */}
      <nav className="flex-1 space-y-1 px-3">
        {NAV.map(({ id, label, icon: Icon }) => {
          const active = page === id
          return (
            <button
              key={id}
              onClick={() => navigate(id)}
              className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm transition-all ${
                active
                  ? 'bg-gradient-to-r from-neon/25 to-purple/20 text-white border border-neon/40 glow-neon'
                  : 'text-fog hover:text-mist hover:bg-navy-800 border border-transparent'
              }`}
            >
              <Icon size={16} className={active ? 'text-cyan' : ''} />
              {label}
            </button>
          )
        })}
      </nav>

      {/* FORGE AI launcher */}
      <button
        onClick={() => setAiOpen(!aiOpen)}
        className={`mx-3 mb-3 flex items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-sm transition-all ${
          aiOpen
            ? 'border-purple/50 bg-purple/15 text-white glow-purple'
            : 'border-line2 text-fog hover:text-mist hover:border-purple/40'
        }`}
      >
        <Sparkles size={15} className="text-purple" />
        Ask FORGE AI
      </button>

      {/* insight card */}
      <div className="mx-3 mb-4 overflow-hidden rounded-xl border border-line bg-navy-800/60 p-4">
        <svg viewBox="0 0 200 44" className="mb-2 h-10 w-full">
          <defs>
            <linearGradient id="sideWave" x1="0" x2="1">
              <stop offset="0" stopColor="#4f7cff" /><stop offset="1" stopColor="#38d9f5" />
            </linearGradient>
          </defs>
          <polyline
            points="0,34 25,28 50,31 75,20 100,24 125,12 150,17 175,7 200,11"
            fill="none" stroke="url(#sideWave)" strokeWidth="1.6" className="wave-draw"
          />
          <polyline
            points="0,40 25,37 50,39 75,33 100,36 125,28 150,31 175,24 200,27"
            fill="none" stroke="#8b5cf6" strokeWidth="1" opacity="0.5" className="wave-draw"
          />
        </svg>
        <p className="text-[12.5px] leading-snug text-mist">
          Smarter insights.<br />Higher efficiency.<br />Better decisions.
        </p>
        <button
          onClick={() => navigate('reports')}
          className="mt-2.5 flex items-center gap-1 text-[11px] font-medium text-cyan hover:text-neon"
        >
          Generate a report <ArrowRight size={11} />
        </button>
      </div>
    </aside>
  )
}

export function MobileNav() {
  const { page, navigate } = useStore()
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex justify-around border-t border-line bg-navy-900/95 py-2 backdrop-blur lg:hidden">
      {NAV.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          onClick={() => navigate(id)}
          aria-label={label}
          className={`grid h-10 w-10 place-items-center rounded-lg ${page === id ? 'bg-neon/20 text-cyan' : 'text-fog'}`}
        >
          <Icon size={17} />
        </button>
      ))}
    </nav>
  )
}
