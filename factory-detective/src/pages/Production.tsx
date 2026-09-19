// PAGE 4 — PRODUCTION FLOW: plant flow with station nodes + bottleneck finder.

import { useEffect, useMemo, useState } from 'react'
import { Crosshair, Info, Search, X } from 'lucide-react'
import {
  Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { api } from '../api'
import { Badge, Button, Panel, SkeletonBlock } from '../components/ui'
import { LEVEL_COLORS, fmtNum, fmtPct } from '../lib/ui'
import { useStore } from '../store'
import type { Bottlenecks, Station } from '../types'

type Thresh = { watch: number; high: number; critical: number }
const DEFAULT_THRESH: Thresh = { watch: 70, high: 85, critical: 95 }

export function Production() {
  const { inspection, navigate } = useStore()
  const [stations, setStations] = useState<Station[] | null>(null)
  const [bk, setBk] = useState<Bottlenecks | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [thresh, setThresh] = useState<Thresh>(DEFAULT_THRESH)
  const [finding, setFinding] = useState(false)

  useEffect(() => {
    let alive = true
    Promise.all([api.stations(), api.bottlenecks()])
      .then(([s, b]) => { if (alive) { setStations(s.stations); setBk(b) } })
      .catch((e) => alive && setErr(e instanceof Error ? e.message : 'Failed to load stations'))
    return () => { alive = false }
  }, [])

  const byId = useMemo(() => {
    const m = new Map<string, { st: Station; score?: number }>()
    stations?.forEach((s) => m.set(s.id, { st: s }))
    bk?.stations?.forEach((s) => { const e = m.get(s.id); if (e) e.score = s.bottleneck_score })
    return m
  }, [stations, bk])

  // level from user-configurable thresholds
  const levelOf = (util: number | null | undefined) => {
    if (util == null) return 'healthy' as const
    if (util >= thresh.critical) return 'critical' as const
    if (util >= thresh.high) return 'high' as const
    if (util >= thresh.watch) return 'watch' as const
    return 'healthy' as const
  }

  const findBottleneck = async () => {
    setFinding(true)
    try {
      const b = await api.bottlenecks()
      setBk(b)
      const top = b.top
      if (top) {
        setSelected(top.id)
        useStore.getState().toast(
          'success',
          `Strongest constraint signal: ${top.name} (score ${fmtNum(top.bottleneck_score, 0)}). Highlighted on the flow.`,
        )
      }
    } catch {
      useStore.getState().toast('error', 'Bottleneck analysis failed — is the backend running?')
    } finally {
      setFinding(false)
    }
  }

  const sel = selected ? byId.get(selected) : undefined

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-mono text-xl font-bold tracking-[0.2em] text-white">PRODUCTION FLOW</h1>
          <p className="mt-1 text-sm text-fog">
            Model 3 plant: Blanking → Presses → Assembly Cells → Paint → Quality → Warehouse.
            Click a station for detail.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ThresholdEditor thresh={thresh} setThresh={setThresh} />
          <Button variant="primary" onClick={findBottleneck} disabled={finding}>
            <Search size={12} /> {finding ? 'ANALYZING…' : 'FIND BOTTLENECK'}
          </Button>
        </div>
      </header>

      {err && (
        <Panel title="FLOW UNAVAILABLE">
          <p className="text-xs text-red-300">{err}</p>
        </Panel>
      )}
      {!stations && !err && <SkeletonBlock className="h-72" />}

      {stations && (
        <Panel
          title="PLANT FLOW — LIVE FROM MODEL 3 (605,620 EVENTS)"
          tag="REAL DATA"
          right={
            <div className="flex items-center gap-3 font-mono text-[9px] tracking-[0.12em] text-fog">
              <LegendDot color="#34d399" label={`< ${thresh.watch}%`} />
              <LegendDot color="#f59e0b" label={`${thresh.watch}–${thresh.high}%`} />
              <LegendDot color="#fbbf24" label={`${thresh.high}–${thresh.critical}%`} />
              <LegendDot color="#ef4444" label={`≥ ${thresh.critical}%`} />
            </div>
          }
        >
          <FlowDiagram
            stations={byId}
            levelOf={levelOf}
            selected={selected}
            onSelect={setSelected}
            caseStation={inspection.station}
          />
        </Panel>
      )}

      {/* detail drawer + ranking */}
      <div className="grid gap-5 xl:grid-cols-2">
        <Panel
          title={sel ? `STATION DETAIL — ${sel.st.name.toUpperCase()}` : 'STATION DETAIL'}
          subtitle={sel ? `${sel.st.util_col}${sel.st.queue_col ? ` · ${sel.st.queue_col}` : ''}` : 'Select a station node'}
          tag="REAL DATA"
          right={sel && <Button variant="ghost" onClick={() => setSelected(null)}><X size={13} /></Button>}
        >
          {sel ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <Stat label="UTILIZATION" value={fmtPct(sel.st.utilization, 1)} tone={LEVEL_COLORS[levelOf(sel.st.utilization)].text} />
                <Stat label="UTIL P95" value={fmtPct(sel.st.utilization_p95, 1)} />
                <Stat label="QUEUE MEAN" value={sel.st.queue_mean != null ? fmtNum(sel.st.queue_mean, 1) : '—'} />
                <Stat label="QUEUE P95" value={sel.st.queue_p95 != null ? fmtNum(sel.st.queue_p95, 1) : '—'} />
              </div>

              <div className="rounded-sm border border-line bg-ink/50 p-3">
                <p className="font-mono text-[10px] tracking-[0.16em] text-fog">STATUS</p>
                <div className="mt-1.5 flex items-center gap-2">
                  <span className={`rounded-sm border px-2 py-1 font-mono text-[10px] tracking-[0.14em] ${LEVEL_COLORS[levelOf(sel.st.utilization)].border} ${LEVEL_COLORS[levelOf(sel.st.utilization)].bg} ${LEVEL_COLORS[levelOf(sel.st.utilization)].text}`}>
                    {LEVEL_COLORS[levelOf(sel.st.utilization)].label}
                  </span>
                  {sel.score != null && (
                    <span className="text-[11px] text-fog">
                      Prototype Bottleneck Score <span className="font-mono text-cyan-300">{fmtNum(sel.score, 1)}</span>
                    </span>
                  )}
                </div>
              </div>

              {sel.st.util_hist.length > 0 && (
                <div>
                  <p className="mb-1 font-mono text-[10px] tracking-[0.16em] text-fog">
                    UTILIZATION DISTRIBUTION — {sel.st.util_col}
                  </p>
                  <div className="h-36">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={sel.st.util_hist} margin={{ top: 4, right: 6, bottom: 0, left: -18 }}>
                        <CartesianGrid stroke="#1e2937" strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="bin" tick={{ fill: '#8b98ab', fontSize: 9 }} tickFormatter={(v) => (v * 100).toFixed(0)} stroke="#2a3849" />
                        <YAxis tick={{ fill: '#8b98ab', fontSize: 9 }} stroke="#2a3849" />
                        <Tooltip
                          contentStyle={{ background: '#0e141d', border: '1px solid #2a3849', fontSize: 11, borderRadius: 4 }}
                          formatter={(v) => [`${v} runs`, 'samples']}
                          labelFormatter={(v) => `util ≈ ${((v as number) * 100).toFixed(1)}%`}
                        />
                        <Bar dataKey="count" fill="#22d3ee" fillOpacity={0.6} radius={[2, 2, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {sel.st.queue_hist.length > 0 && (
                <div>
                  <p className="mb-1 font-mono text-[10px] tracking-[0.16em] text-fog">
                    QUEUE DISTRIBUTION — {sel.st.queue_col}
                  </p>
                  <div className="h-32">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={sel.st.queue_hist} margin={{ top: 4, right: 6, bottom: 0, left: -18 }}>
                        <CartesianGrid stroke="#1e2937" strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="bin" tick={{ fill: '#8b98ab', fontSize: 9 }} stroke="#2a3849" />
                        <YAxis tick={{ fill: '#8b98ab', fontSize: 9 }} stroke="#2a3849" />
                        <Tooltip
                          contentStyle={{ background: '#0e141d', border: '1px solid #2a3849', fontSize: 11, borderRadius: 4 }}
                          formatter={(v) => [`${v} runs`, 'samples']}
                        />
                        <Bar dataKey="count" fill="#f59e0b" fillOpacity={0.55} radius={[2, 2, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              <button
                onClick={() => navigate('simulator')}
                className="flex w-full items-center justify-center gap-2 rounded-md border border-cyan-500/50 bg-cyan-500/15 px-3 py-2 font-mono text-[11px] font-semibold tracking-[0.12em] text-cyan-100 hover:bg-cyan-500/25"
              >
                SIMULATE A CHANGE AT THIS STATION
              </button>
            </div>
          ) : (
            <div className="grid place-items-center py-12 text-center">
              <Crosshair size={22} className="text-fog" />
              <p className="mt-2 text-xs text-fog">Click any station on the flow to inspect utilization, queues and distributions.</p>
            </div>
          )}
        </Panel>

        <Panel
          title="CONSTRAINT RANKING"
          subtitle="Prototype Bottleneck Score = 0.5·util + 0.3·queue + 0.2·wait (configurable in API)"
          tag="REAL DATA"
        >
          {bk ? (
            <>
              <ol className="space-y-2">
                {bk.stations.map((s, i) => (
                  <li key={s.id}>
                    <button
                      onClick={() => setSelected(s.id)}
                      className={`flex w-full items-center gap-3 rounded-sm border px-2.5 py-2 text-left transition-colors ${
                        selected === s.id ? 'border-cyan-500/50 bg-cyan-500/10' : 'border-transparent hover:border-line2'
                      }`}
                    >
                      <span className="font-mono text-[10px] text-fog">{String(i + 1).padStart(2, '0')}</span>
                      <span className="w-32 shrink-0 truncate text-xs text-mist">{s.name}</span>
                      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-line">
                        <span
                          className="block h-full rounded-full transition-all duration-700"
                          style={{
                            width: `${s.bottleneck_score ?? 0}%`,
                            background: i === 0
                              ? 'linear-gradient(90deg,#f59e0b,#ef4444)'
                              : 'linear-gradient(90deg,#0e7490,#22d3ee)',
                          }}
                        />
                      </span>
                      <span className="w-9 text-right font-mono text-[11px] tabular-nums text-cyan-300">
                        {fmtNum(s.bottleneck_score, 0)}
                      </span>
                    </button>
                  </li>
                ))}
              </ol>
              <p className="mt-3 flex items-start gap-2 rounded-sm border border-line bg-ink/60 px-3 py-2 text-[11px] leading-relaxed text-fog">
                <Info size={13} className="mt-0.5 shrink-0 text-cyan-300" />
                Analytical indicator only — not a scientifically validated metric. Weights are
                exposed in the API and can be tuned by judges.
              </p>
            </>
          ) : (
            <SkeletonBlock className="h-56" />
          )}
        </Panel>
      </div>
    </div>
  )
}

// --------------------------------------------------------------------------- //
// Flow diagram
// --------------------------------------------------------------------------- //

function FlowDiagram({
  stations, levelOf, selected, onSelect, caseStation,
}: {
  stations: Map<string, { st: Station; score?: number }>
  levelOf: (u: number | null | undefined) => 'healthy' | 'watch' | 'high' | 'critical'
  selected: string | null
  onSelect: (id: string) => void
  caseStation: string
}) {
  const node = (id: string): { st: Station; score?: number } | undefined => stations.get(id)
  const c = (id: string) => {
    const e = node(id)
    return e ? LEVEL_COLORS[levelOf(e.st.utilization)] : LEVEL_COLORS.healthy
  }
  const st = (id: string) => node(id)?.st

  const W = 980, H = 470

  const StationNode = ({ id, x, y, w = 118, h = 64, label }: {
    id: string; x: number; y: number; w?: number; h?: number; label?: string
  }) => {
    const e = node(id)
    const col = c(id)
    const isSel = selected === id
    const isCase = caseStation === id
    const s = st(id)
    if (!e || !s) return null
    return (
      <g
        onClick={() => onSelect(id)}
        className="cursor-pointer"
        role="button"
        aria-label={s.name}
      >
        <rect
          x={x} y={y} width={w} height={h} rx={7}
          fill={isSel ? 'rgba(34,211,238,0.10)' : '#0e141d'}
          stroke={isSel ? '#22d3ee' : col.border.replace('border-', '#') === col.border ? col.dot : col.dot}
          strokeWidth={isSel ? 2 : 1.4}
          opacity={0.96}
        />
        {isCase && (
          <rect x={x - 3} y={y - 3} width={w + 6} height={h + 6} rx={9} fill="none"
            stroke="#f59e0b" strokeWidth={1} strokeDasharray="5 4" />
        )}
        <text x={x + w / 2} y={y + 17} textAnchor="middle" fontSize={10.5} fontWeight={700}
          fill="#e8edf4" fontFamily="monospace" letterSpacing={1}>
          {(label ?? s.name).toUpperCase()}
        </text>
        <text x={x + w / 2} y={y + 33} textAnchor="middle" fontSize={10}
          fill={col.text} fontFamily="monospace">
          UTIL {s.utilization != null ? `${s.utilization.toFixed(1)}%` : '—'}
        </text>
        <text x={x + w / 2} y={y + 47} textAnchor="middle" fontSize={9}
          fill="#8b98ab" fontFamily="monospace">
          Q {s.queue_mean != null ? s.queue_mean.toFixed(1) : '—'} · {col.label}
        </text>
        <circle cx={x + 10} cy={y + 12} r={3.4} fill={col.dot}>
          <animate attributeName="opacity" values="1;0.4;1" dur="2.4s" repeatCount="indefinite" />
        </circle>
      </g>
    )
  }

  const Flow = ({ d }: { d: string }) => (
    <path d={d} fill="none" stroke="#2a3849" strokeWidth={1.6} className="flow-line" />
  )

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="mx-auto block h-auto w-full min-w-[840px]" role="img"
        aria-label="Plant production flow diagram">
        {/* RAW → BLANKING */}
        <text x={70} y={62} textAnchor="middle" fontSize={10} fill="#8b98ab" fontFamily="monospace" letterSpacing={2}>RAW MATERIAL</text>
        <Flow d="M 70 72 L 70 96 L 130 96 L 130 118" />
        <StationNode id="BLANKING" x={71} y={118} label="Blanking" />

        {/* BLANKING → 4 presses */}
        <Flow d="M 130 182 L 130 214" />
        {(['PRESS1', 'PRESS2', 'PRESS3', 'PRESS4'] as const).map((id, i) => {
          const x = 62 + i * 152
          return (
            <g key={id}>
              <Flow d={`M 130 214 L 130 224 L ${x + 59} 224 L ${x + 59} 244`} />
              <StationNode id={id} x={x} y={244} label={`Press ${i + 1}`} />
              <Flow d={`M ${x + 59} 308 L ${x + 59} 330`} />
            </g>
          )
        })}
        {/* presses → cells bus */}
        <line x1={62 + 59} y1={330} x2={62 + 3 * 152 + 59} y2={330} stroke="#2a3849" strokeWidth={1.6} />
        <Flow d="M 490 330 L 490 352" />

        {/* cells */}
        {(['CELL1', 'CELL2', 'CELL3', 'CELL4'] as const).map((id, i) => {
          const x = 96 + i * 136
          return (
            <g key={id}>
              <Flow d={`M 490 352 L ${x + 52} 352 L ${x + 52} 362`} />
              <StationNode id={id} x={x} y={362} w={104} h={58} label={`Cell ${i + 1}`} />
            </g>
          )
        })}
        {/* cells → paint bus */}
        {(['CELL1', 'CELL2', 'CELL3', 'CELL4'] as const).map((id, i) => {
          const x = 96 + i * 136 + 52
          return <Flow key={`c${id}`} d={`M ${x} 420 L ${x} 436`} />
        })}
        <line x1={148} y1={436} x2={504} y2={436} stroke="#2a3849" strokeWidth={1.6} />

        {/* right rail: forklift, paint, quality, warehouse */}
        <Flow d="M 250 362 L 720 362 L 720 244" />
        <StationNode id="FORKLIFT" x={661} y={180} w={118} h={64} />
        <text x={720} y={170} textAnchor="middle" fontSize={9} fill="#8b98ab" fontFamily="monospace" letterSpacing={1.5}>MATERIAL HANDLING</text>
        <Flow d="M 720 180 L 720 156 L 800 156" />

        <StationNode id="PAINT1" x={800} y={92} w={104} h={58} label="Paint 1" />
        <StationNode id="PAINT2" x={800} y={162} w={104} h={58} label="Paint 2" />
        <Flow d="M 904 191 L 924 191 L 924 240 L 860 240 L 860 250" />
        <StationNode id="QUALITY" x={800} y={250} w={104} h={58} />
        <Flow d="M 852 308 L 852 330" />
        <text x={852} y={352} textAnchor="middle" fontSize={10} fill="#8b98ab" fontFamily="monospace" letterSpacing={1.5}>WAREHOUSE</text>
        <text x={852} y={368} textAnchor="middle" fontSize={9.5} fill="#8b98ab" fontFamily="monospace">
          W1 Q {fmtNum(stationQueue(stations, 'BLANKING') ?? 0, 0)}
        </text>
      </svg>
    </div>
  )
}

function stationQueue(m: Map<string, { st: Station; score?: number }>, id: string): number | null {
  return m.get(id)?.st.queue_mean ?? null
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <span className="h-2 w-2 rounded-sm" style={{ background: color }} />
      {label}
    </span>
  )
}

function Stat({ label, value, tone = 'text-white' }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-sm border border-line bg-ink/50 px-3 py-2.5">
      <p className="font-mono text-[9px] tracking-[0.16em] text-fog">{label}</p>
      <p className={`mt-1 font-mono text-lg font-semibold tabular-nums ${tone}`}>{value}</p>
    </div>
  )
}

function ThresholdEditor({ thresh, setThresh }: { thresh: Thresh; setThresh: (t: Thresh) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <Button variant="default" onClick={() => setOpen((v) => !v)}>
        THRESHOLDS: {thresh.watch}/{thresh.high}/{thresh.critical}
      </Button>
      {open && (
        <div className="absolute right-0 top-11 z-50 w-64 rounded-md border border-line bg-panel p-3 shadow-2xl">
          <p className="mb-2 font-mono text-[10px] tracking-[0.14em] text-fog">
            STATUS THRESHOLDS (% UTILIZATION)
          </p>
          {(['watch', 'high', 'critical'] as const).map((k) => (
            <label key={k} className="mt-2 block">
              <span className="flex justify-between font-mono text-[10px] text-mist">
                <span className="uppercase">{k} ≥</span><span>{thresh[k]}%</span>
              </span>
              <input
                type="range" min={50} max={99} value={thresh[k]}
                onChange={(e) => setThresh({ ...thresh, [k]: Number(e.target.value) })}
                className="mt-1 w-full"
              />
            </label>
          ))}
          <button
            onClick={() => setThresh(DEFAULT_THRESH)}
            className="mt-2 w-full rounded-sm border border-line2 py-1.5 font-mono text-[10px] text-fog hover:text-mist"
          >
            RESET DEFAULTS (70/85/95)
          </button>
        </div>
      )}
    </div>
  )
}

export const __prodIcons = { Badge }
