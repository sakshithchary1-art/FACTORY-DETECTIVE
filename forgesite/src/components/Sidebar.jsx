// FORGE SIGHT sidebar — control-system navigation.
// Grouped sections, left-rail active state, quiet inactive items.

import { Home, Search, ShieldCheck, GitBranch, FlaskConical, FileText, ArrowRight } from 'lucide-react'
import { useStore } from '../store'
import { ForgeSightLogo } from '../brand/ForgeSightLogo'

const NAV_GROUPS = [
  {
    label: 'Operations',
    items: [
      { id: 'overview', label: 'Overview', icon: Home },
      { id: 'flow', label: 'Production', icon: GitBranch },
    ],
  },
  {
    label: 'Analysis',
    items: [
      { id: 'investigate', label: 'Find the Cause', icon: ShieldCheck },
      { id: 'simulate', label: 'What-If Test', icon: FlaskConical },
    ],
  },
  {
    label: 'Records',
    items: [
      { id: 'inspect', label: 'Product Inspection', icon: Search },
      { id: 'reports', label: 'AI Summary', icon: FileText },
    ],
  },
]

export function Sidebar() {
  const { page, navigate } = useStore()
  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-56 flex-col border-r border-line bg-white lg:flex">
      {/* brand */}
      <div className="border-b border-line px-4 pt-4 pb-3.5">
        <ForgeSightLogo size={30} compact />
      </div>

      {/* nav */}
      <nav className="flex-1 overflow-y-auto px-2.5 py-3">
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="mb-4">
            <p className="mb-1 px-2.5 text-[9.5px] font-semibold tracking-[0.12em] text-fog/80 uppercase">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map(({ id, label, icon: Icon }) => {
                const active = page === id
                return (
                  <button
                    key={id}
                    onClick={() => navigate(id)}
                    aria-current={active ? 'page' : undefined}
                    className={`relative flex w-full items-center gap-2.5 rounded-md px-2.5 py-[7px] text-[13px] transition-colors ${
                      active
                        ? 'bg-neon/[0.07] font-semibold text-neon'
                        : 'text-mist hover:bg-navy-850'
                    }`}
                  >
                    {active && <span className="absolute inset-y-1.5 left-0 w-[2.5px] rounded-full bg-neon" />}
                    <Icon size={15} strokeWidth={active ? 2.1 : 1.8} className={active ? 'text-neon' : 'text-fog'} />
                    {label}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* footer note */}
      <div className="border-t border-line px-4 py-3">
        <p className="text-[10.5px] leading-relaxed text-fog">
          See the problem.<br />Find the cause.
        </p>
        <button
          onClick={() => navigate('reports')}
          className="mt-1.5 flex items-center gap-1 text-[11px] font-medium text-neon hover:text-cyan"
        >
          Generate AI Summary <ArrowRight size={11} />
        </button>
      </div>
    </aside>
  )
}

export function MobileNav() {
  const { page, navigate } = useStore()
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex justify-around border-t border-line bg-white py-1.5 lg:hidden">
      {NAV_GROUPS.flatMap((g) => g.items).map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          onClick={() => navigate(id)}
          aria-label={label}
          className={`grid h-9 w-10 place-items-center rounded-md ${page === id ? 'bg-neon/[0.07] text-neon' : 'text-fog'}`}
        >
          <Icon size={16} />
        </button>
      ))}
    </nav>
  )
}
