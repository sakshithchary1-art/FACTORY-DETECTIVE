// PAGE 3 — INVESTIGATE: root-cause investigation timeline + evidence.

import { useEffect, useMemo, useState } from 'react'
import {
  ArrowDown, ArrowRight, Boxes, CircleAlert, GitBranch,
  Layers, Timer, TrendingDown,
} from 'lucide-react'
import {
  CartesianGrid, ReferenceLine, ResponsiveContainer, Scatter, ScatterChart,
  Tooltip, XAxis, YAxis, ZAxis,
} from 'recharts'
import { api } from '../api'
import { Badge, ConfidenceBar, Panel, SkeletonBlock } from '../components/ui'
import { SEVERITY_META, fmtNum } from '../lib/ui'
import { DEMO_CASE_ID } from '../store'
import { useStore } from '../store'
import type { CorrPair, Investigation, ScatterData } from '../types'

const TIMELINE_STEPS = [
  { stage: 'DEFECT', icon: CircleAlert },
  { stage: 'BATCH', icon: Layers },
  { stage: 'STATION', icon: Boxes },
  { stage: 'PROCESS SIGNAL', icon: Timer },
  { stage: 'CONSTRAINT', icon: GitBranch },
  { stage: 'IMPACT', icon: TrendingDown },
]

const SCATTER_PRESETS = [
  { x: 'Demand', y: 'Assembly Waiting Time', label: 'Demand vs Assembly wait' },
  { x: 'Parts per hour', y: 'Drilling Util', label: 'Throughput vs Drilling util' },
  { x: 'Drilling Util', y: 'Assembly Util', label: 'Drilling vs Assembly util' },
  { x: 'Demand', y: 'Parts per hour', label: 'Demand vs Throughput' },
]

export function Investigate() {
  const [inv, setInv] = useState<Investigation | null>(null)
  const [corr1, setCorr1] = useState<CorrPair[]>([])
  const [corr2, setCorr2] = useState<CorrPair[]>([])
  const [corr3, setCorr3] = useState<CorrPair[]>([])
  const [err, setErr] = useState<string | null>(null)
  const [preset, setPreset] = useState(SCATTER_PRESETS[0])
  const [scatter, setScatter] = useState<ScatterData | null>(null)

  useEffect(() => {
    let alive = true
    const caseId = DEMO_CASE_ID
    Promise.all([
      api.investigation(caseId),
      api.modelCorrelations(1),
      api.modelCorrelations(2),
      api.modelCorrelations(3),
    ])
      .then(([i, c1, c2, c3]) => {
        if (!alive) return
        setInv(i); setCorr1(c1.pairs); setCorr2(c2.pairs); setCorr3(c3.pairs)
      })
      .catch((e) => alive && setErr(e instanceof Error ? e.message : 'Failed to load investigation'))
    return () => { alive = false }
  }, [])

  useEffect(() => {
    let alive = true
    setScatter(null)
    api.modelScatter(1, preset.x, preset.y)
      .then((s) => alive && setScatter(s))
      .catch(() => alive && setScatter({ available: false, x: '', y: '', r: null, points: [] }))
    return () => { alive = false }
  }, [preset])

  const timelineValues = useMemo(() => {
    const m = inv?.metrics
    return [
      inv?.defect ?? '—',
      inv?.batch ?? '—',
      `${stationNo(inv?.station ?? '')} · ${inv?.station_name ?? '—'}`,
      'Cycle-time variation',
      `High utilization${m?.utilization != null ? ` (${fmtNum(m.utilization, 1)}%)` : ''}`,
      m?.queue_mean != null
        ? `Waiting (${fmtNum(m.queue_mean, 1)} q) + lost output`
        : 'Waiting + lost output',
    ]
  }, [inv])

  const corrAll = useMemo(() => ([
    { model: 'M1', pairs: corr1 }, { model: 'M2', pairs: corr2 }, { model: 'M3', pairs: corr3 },
  ]), [corr1, corr2, corr3])

  const loading = !inv && !err

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-mono text-xl font-bold tracking-[0.2em] text-white">ROOT-CAUSE INVESTIGATION</h1>
          <p className="mt-1 text-sm text-fog">
            Evidence traced from the defect to the process — correlation, not claimed causation.
          </p>
        </div>
        {inv && <Badge tone="cyan">CASE {inv.id}</Badge>}
      </header>

      {err && (
        <Panel title="INVESTIGATION UNAVAILABLE">
          <p className="text-xs text-red-300">{err}</p>
        </Panel>
      )}
      {loading && <SkeletonBlock className="h-64" />}

      {inv && (
        <>
          {/* timeline */}
          <Panel
            title="INVESTIGATION TIMELINE"
            subtitle={inv.narrative}
            tag={inv.demo ? 'DEMO DATA' : 'REAL DATA'}
          >
            <ol className="grid gap-2 md:grid-cols-6">
              {TIMELINE_STEPS.map((s, i) => {
                const Icon = s.icon
                return (
                  <li key={s.stage} className="relative">
                    <div
                      className="rise-in h-full rounded-md border bg-panel2/70 p-3"
                      style={{ animationDelay: `${i * 90}ms`, borderColor: i === 3 ? 'rgba(245,158,11,0.45)' : i === 4 ? 'rgba(34,211,238,0.4)' : undefined }}
                    >
                      <div className="flex items-center gap-1.5">
                        <Icon size={12} className={i >= 3 ? 'text-amber-400' : 'text-cyan-300'} />
                        <p className="font-mono text-[9px] tracking-[0.16em] text-fog">{s.stage}</p>
                      </div>
                      <p className="mt-1.5 text-[12px] font-semibold leading-snug text-white">
                        {timelineValues[i]}
                      </p>
                    </div>
                    {i < TIMELINE_STEPS.length - 1 && (
                      <ArrowDown className="absolute -bottom-3.5 left-1/2 z-10 hidden h-3 w-3 -translate-x-1/2 text-fog md:block" />
                    )}
                  </li>
                )
              })}
            </ol>
          </Panel>

          <div className="grid gap-5 xl:grid-cols-2">
            {/* signals */}
            <Panel title="ROOT-CAUSE SIGNALS" subtitle="Each signal carries its evidence kind and confidence" tag="REAL DATA">
              <ul className="space-y-3">
                {inv.signals.map((s, i) => {
                  const meta = SEVERITY_META[s.severity] ?? SEVERITY_META.info
                  const kindLabel =
                    s.kind === 'dataset_metric' ? 'DATASET METRIC' :
                    s.kind === 'dataset_correlation' ? 'CORRELATION ONLY' : 'DEMO LINK'
                  return (
                    <li
                      key={s.id}
                      className="rise-in rounded-md border border-line bg-panel2/50 p-3"
                      style={{ animationDelay: `${i * 80}ms` }}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-[10px] text-fog">SIGNAL {String(s.id).padStart(2, '0')}</span>
                        <span className={`rounded-sm border px-1.5 py-0.5 font-mono text-[9px] tracking-[0.1em] ${meta.border} ${meta.text} ${meta.bg}`}>
                          {meta.label}
                        </span>
                        <span className="ml-auto flex items-center gap-2">
                          <span className={`rounded-sm border px-1.5 py-0.5 font-mono text-[9px] tracking-[0.1em] ${
                            s.kind === 'dataset_correlation'
                              ? 'border-amber-500/40 text-amber-300'
                              : s.kind === 'demo_link'
                                ? 'border-cyan-500/40 text-cyan-300'
                                : 'border-emerald-500/40 text-emerald-400'
                          }`}>
                            {kindLabel}
                          </span>
                          <span className="font-mono text-[11px] tabular-nums text-cyan-300">
                            {fmtNum(s.confidence, 0)}%
                          </span>
                        </span>
                      </div>
                      <p className="mt-1.5 text-sm font-semibold text-white">{s.title}</p>
                      <p className="mt-1 text-xs leading-relaxed text-fog">{s.detail}</p>
                      <p className="mt-1.5 font-mono text-[9.5px] tracking-wide text-fog/70">SOURCE · {s.source}</p>
                      <div className="mt-2">
                        <ConfidenceBar value={s.confidence} tone={s.confidence > 75 ? 'cyan' : 'amber'} />
                      </div>
                    </li>
                  )
                })}
              </ul>
              <p className="mt-3 rounded-sm border border-amber-500/25 bg-amber-500/5 px-3 py-2 text-[11px] leading-relaxed text-amber-200/90">
                Wording note: signals describe statistical associations in the simulation dataset.
                They are possible contributing factors — not confirmed causes.
              </p>
            </Panel>

            {/* correlation evidence */}
            <div className="space-y-5">
              <Panel title="CORRELATION EVIDENCE" subtitle="Pearson r across the supplied run sets" tag="REAL DATA">
                <div className="space-y-4">
                  {corrAll.map(({ model, pairs }) => (
                    <div key={model}>
                      <p className="mb-1.5 font-mono text-[10px] tracking-[0.16em] text-cyan-300/90">
                        MODEL {model.slice(1)} {model === 'M3' && '· vs c_TotalProducts'}
                      </p>
                      <ul className="space-y-1">
                        {pairs.slice(0, 5).map((p) => (
                          <CorrRow key={`${model}-${p.a}-${p.b}`} pair={p} />
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </Panel>

              <Panel title="RELATIONSHIP VIEW" subtitle={preset.label} tag="REAL DATA">
                <div className="mb-3 flex flex-wrap gap-1.5">
                  {SCATTER_PRESETS.map((p) => (
                    <button
                      key={p.label}
                      onClick={() => setPreset(p)}
                      className={`rounded-sm border px-2 py-1 font-mono text-[10px] tracking-wide transition-colors ${
                        preset.label === p.label
                          ? 'border-cyan-500/50 bg-cyan-500/10 text-cyan-200'
                          : 'border-line2 text-fog hover:text-mist'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
                {scatter?.available ? (
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <ScatterChart margin={{ top: 8, right: 12, bottom: 18, left: 4 }}>
                        <CartesianGrid stroke="#1e2937" strokeDasharray="3 3" />
                        <XAxis
                          type="number" dataKey="x" name={scatter.x} tick={{ fill: '#8b98ab', fontSize: 10 }}
                          stroke="#2a3849" label={{ value: scatter.x, fill: '#8b98ab', fontSize: 10, position: 'insideBottom', offset: -6 }}
                        />
                        <YAxis
                          type="number" dataKey="y" name={scatter.y} tick={{ fill: '#8b98ab', fontSize: 10 }} width={52}
                          stroke="#2a3849"
                        />
                        <ZAxis range={[14, 15]} />
                        <ReferenceLine stroke="#2a3849" />
                        <Tooltip
                          contentStyle={{ background: '#0e141d', border: '1px solid #2a3849', fontSize: 11, borderRadius: 4 }}
                          labelStyle={{ color: '#b9c4d4' }}
                          formatter={(v: unknown) => (typeof v === 'number' ? v.toLocaleString('en-US') : String(v ?? ''))}
                        />
                        <Scatter data={scatter.points} fill="#22d3ee" fillOpacity={0.55} />
                      </ScatterChart>
                    </ResponsiveContainer>
                    <p className="mt-1 text-center font-mono text-[10px] text-fog">
                      Pearson r = {scatter.r != null ? scatter.r.toFixed(3) : '—'} · sample of {scatter.points.length.toLocaleString()} runs · Model 1
                    </p>
                  </div>
                ) : (
                  <SkeletonBlock className="h-56" />
                )}
              </Panel>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              onClick={() => useStore.getState().navigate('production')}
              className="flex items-center gap-2 rounded-md border border-cyan-500/50 bg-cyan-500/15 px-4 py-2 font-mono text-[11px] font-semibold tracking-[0.12em] text-cyan-100 transition-all hover:bg-cyan-500/25"
            >
              TRACE THROUGH PRODUCTION FLOW <ArrowRight size={12} />
            </button>
          </div>
        </>
      )}
    </div>
  )
}

function CorrRow({ pair }: { pair: CorrPair }) {
  const r = pair.r ?? 0
  const pct = Math.min(100, Math.abs(r) * 100)
  const pos = r >= 0
  return (
    <li className="flex items-center gap-2 text-[11px]">
      <span className="w-40 shrink-0 truncate text-fog" title={`${pair.a} ↔ ${pair.b}`}>
        {pair.a} ↔ {pair.b}
      </span>
      <span className="relative h-1.5 flex-1 rounded-full bg-line">
        <span
          className={`absolute inset-y-0 rounded-full ${pos ? 'bg-cyan-400/80 left-1/2' : 'bg-amber-400/80 right-1/2'}`}
          style={{ width: `${pct / 2}%` }}
        />
        <span className="absolute inset-y-[-2px] left-1/2 w-px bg-line2" />
      </span>
      <span className={`w-12 text-right font-mono tabular-nums ${pos ? 'text-cyan-300' : 'text-amber-300'}`}>
        {r >= 0 ? '+' : ''}{r.toFixed(2)}
      </span>
    </li>
  )
}

function stationNo(id: string): string {
  const map: Record<string, string> = {
    PRESS1: '01', PRESS2: '02', PRESS3: '04', PRESS4: '05',
    CELL1: '11', CELL2: '12', CELL3: '13', CELL4: '14',
    BLANKING: 'BLK', QUALITY: 'QC', PAINT1: 'P1', PAINT2: 'P2', FORKLIFT: 'FL',
  }
  return map[id] ?? id
}

export const __invIcons = {}
