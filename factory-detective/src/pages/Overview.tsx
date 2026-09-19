// PAGE 1 — OVERVIEW: executive command center.

import { useEffect, useState } from 'react'
import {
  ArrowRight, BadgeCheck, CircleGauge, Factory, FileSearch,
  Gauge, Play, Layers, ShieldAlert, Timer, TrendingUp, Wallet, Wand2,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { api } from '../api'
import { InvestigationPipeline } from '../components/InvestigationPipeline'
import { Badge, Button, EmptyState, MetricCard, Panel, SkeletonBlock } from '../components/ui'
import { fmtInt, fmtNum, fmtPct } from '../lib/ui'
import { DEMO_CASE_ID, useStore } from '../store'
import type { Bottlenecks, Investigation, ModelSummary } from '../types'

export function Overview() {
  const { navigate, backendOnline } = useStore()
  const [m1, setM1] = useState<ModelSummary | null>(null)
  const [m3, setM3] = useState<ModelSummary | null>(null)
  const [bk, setBk] = useState<Bottlenecks | null>(null)
  const [inv, setInv] = useState<Investigation | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    Promise.all([
      api.modelSummary(1), api.modelSummary(3), api.bottlenecks(), api.investigation(DEMO_CASE_ID),
    ])
      .then(([a, b, c, d]) => {
        if (!alive) return
        setM1(a); setM3(b); setBk(c); setInv(d)
      })
      .catch((e) => alive && setErr(e instanceof Error ? e.message : 'Failed to load overview'))
    return () => { alive = false }
  }, [])

  const loading = !m1 && !m3 && !err
  const utilMean = m3?.stations?.length
    ? m3.stations.reduce((s, x) => s + (x.utilization ?? 0), 0) / m3.stations.length
    : null
  const queuePressure = bk?.stations?.length
    ? bk.stations.reduce((s, x) => s + (x.queue_mean ?? 0), 0) / bk.stations.length
    : null
  const topBk = bk?.top

  return (
    <div className="space-y-5">
      {/* hero */}
      <section className="bg-grid relative overflow-hidden rounded-lg border border-line bg-panel/50 px-6 py-8 md:px-10 md:py-12">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-cyan-500/8 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-16 h-72 w-72 rounded-full bg-cyan-500/5 blur-3xl" />
        <div className="relative">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="cyan">NEURAX HACKATHON 3.0 · AI IN INDUSTRY & AUTOMATION</Badge>
            <Badge tone="green">SOFTWARE-ONLY DECISION SUPPORT</Badge>
          </div>
          <h1 className="mt-4 font-mono text-3xl font-bold tracking-[0.24em] text-white md:text-5xl">
            FACTORY DETECTIVE
          </h1>
          <p className="mt-3 max-w-2xl text-lg text-mist md:text-xl">
            “From a defect on the product to the story behind it.”
          </p>
          <p className="mt-2 max-w-2xl text-sm text-fog">
            AI-powered manufacturing investigation and decision support — connect the defect,
            the process evidence, the bottleneck, the cost and the fix in one investigation.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button variant="primary" onClick={() => navigate('inspect')}>
              <Play size={12} className="fill-cyan-200" /> START WITH INSPECTION
            </Button>
            <Button onClick={() => navigate('explorer')}>EXPLORE THE DATASET</Button>
            {backendOnline === false && (
              <span className="self-center font-mono text-[11px] text-red-400">
                Backend offline — start the FastAPI server
              </span>
            )}
          </div>
        </div>
      </section>

      <InvestigationPipeline />

      {err && (
        <EmptyState
          icon={<Factory size={28} />}
          title="OVERVIEW UNAVAILABLE"
          body={`${err} — make sure the backend is running: uvicorn main:app --reload`}
          action={<Button onClick={() => window.location.reload()}>RETRY</Button>}
        />
      )}
      {loading && <SkeletonBlock className="h-56" />}

      {!loading && !err && (
        <>
          {/* KPI row */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <MetricCard
              label="THROUGHPUT" value={fmtInt(m3?.kpi?.total_products_mean ?? null)} unit="products/run"
              sub="Model 3 · c_TotalProducts mean" icon={<TrendingUp size={14} />}
            />
            <MetricCard
              label="UTILIZATION" value={fmtPct(utilMean, 1)} unit="plant mean"
              sub="13 stations · Model 3" level={utilLevel(utilMean)} icon={<Gauge size={14} />}
            />
            <MetricCard
              label="QUEUE PRESSURE" value={fmtNum(queuePressure, 1)} unit="units avg"
              sub="mean queue across stations" icon={<Layers size={14} />}
            />
            <MetricCard
              label="QUALITY RISK" value={fmtPct(m1?.kpi?.assembly_util_mean, 0)} unit="assembly util"
              sub="Model 1 · 3,000 runs" level={utilLevel(m1?.kpi?.assembly_util_mean)} icon={<ShieldAlert size={14} />}
            />
            <MetricCard
              label="ESTIMATED IMPACT" value={fmtMoneyShort(costPreview())} sub="user-configured assumptions"
              icon={<Wallet size={14} />}
            />
            <MetricCard
              label="SIMULATION STATUS" value="READY" sub="prototype what-if engine"
              level="healthy" icon={<Wand2 size={14} />}
            />
          </div>

          <div className="grid gap-5 xl:grid-cols-5">
            {/* current investigation */}
            <Panel
              title="CURRENT INVESTIGATION"
              tag="DEMO DATA"
              className="xl:col-span-3"
              right={<Badge tone="amber">ACTIVE</Badge>}
            >
              {inv ? (
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-mono text-xl font-bold tracking-[0.14em] text-white">
                        INVESTIGATION #{inv.id}
                      </p>
                      <p className="mt-1 text-xs text-fog">{inv.narrative}</p>
                    </div>
                    <Button variant="primary" onClick={() => navigate('inspect')}>
                      OPEN CASE <ArrowRight size={12} />
                    </Button>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
                    <CaseFact label="DEFECT" value={inv.defect} />
                    <CaseFact label="BATCH" value={inv.batch} />
                    <CaseFact label="STATION" value={`${stationNo(inv.station)} · ${inv.station_name}`} />
                    <CaseFact
                      label="STATUS"
                      value="Root cause investigation active"
                      tone="text-amber-300"
                    />
                  </div>
                  <div className="mt-4 rounded-md border border-line bg-panel2/60 p-3">
                    <p className="font-mono text-[10px] tracking-[0.16em] text-fog">EVIDENCE FOUND</p>
                    <ul className="mt-2 space-y-1.5">
                      {(inv.signals ?? []).filter((s) => s.kind !== 'demo_link').slice(0, 4).map((s) => (
                        <li key={s.id} className="flex items-center gap-2 text-xs text-mist">
                          <BadgeCheck size={13} className="shrink-0 text-cyan-300" />
                          {s.title}
                          <span className="ml-auto font-mono text-[10px] text-fog">
                            {fmtNum(s.confidence, 0)}% signal conf.
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ) : (
                <SkeletonBlock className="h-44" />
              )}
            </Panel>

            {/* bottleneck snapshot */}
            <Panel
              title="TOP CONSTRAINT CANDIDATES"
              subtitle="Prototype Bottleneck Score — transparent heuristic, not a validated metric"
              tag="REAL DATA"
              className="xl:col-span-2"
            >
              {bk ? (
                <ol className="space-y-2.5">
                  {bk.stations.slice(0, 5).map((s, i) => (
                    <li key={s.id}>
                      <button
                        onClick={() => navigate('production')}
                        className="group flex w-full items-center gap-3 rounded-sm border border-transparent px-1 py-1 text-left hover:border-line2"
                      >
                        <span className="font-mono text-[10px] text-fog">0{i + 1}</span>
                        <span className="w-28 shrink-0 truncate text-xs text-mist group-hover:text-white">
                          {s.name}
                        </span>
                        <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-line">
                          <span
                            className="block h-full rounded-full bg-gradient-to-r from-cyan-500 to-cyan-300 transition-all duration-700"
                            style={{ width: `${s.bottleneck_score ?? 0}%` }}
                          />
                        </span>
                        <span className="w-10 text-right font-mono text-[11px] tabular-nums text-cyan-300">
                          {fmtNum(s.bottleneck_score, 0)}
                        </span>
                      </button>
                    </li>
                  ))}
                </ol>
              ) : (
                <SkeletonBlock className="h-40" />
              )}
              {topBk && (
                <p className="mt-3 text-[11px] leading-relaxed text-fog">
                  <span className="text-mist">{topBk.name}</span> carries the strongest constraint
                  signal — {fmtPct(topBk.utilization, 1)} mean utilization
                  {topBk.queue_mean != null && <> with {fmtNum(topBk.queue_mean, 1)} units queued</>}.
                </p>
              )}
            </Panel>
          </div>

          {/* dataset proof strip */}
          <div className="grid gap-3 md:grid-cols-3">
            <DatasetProof
              title="MODEL 1 — 3,000 RUNS"
              lines={[
                `Demand → parts/hour · assembly wait mean ${fmtNum(m1?.kpi?.assembly_wait_mean, 1)} min`,
                `Util means: drill ${fmtPct(m1?.kpi?.drilling_util_mean, 0)} · mill ${fmtPct(m1?.kpi?.milling_util_mean, 0)} · asm ${fmtPct(m1?.kpi?.assembly_util_mean, 0)}`,
              ]}
              onClick={() => navigate('explorer')}
              icon={<FileSearch size={14} />}
            />
            <DatasetProof
              title="MODEL 3 — 605,620 EVENTS"
              lines={[
                `Total products mean ${fmtInt(m3?.kpi?.total_products_mean)} · ${m3?.n_features ?? '—'} features`,
                `Quality queue mean ${fmtNum(m3?.kpi?.quality_queue_mean, 1)} · Warehouse1 ${fmtNum(m3?.kpi?.warehouse1_queue_mean, 1)}`,
              ]}
              onClick={() => navigate('explorer')}
              icon={<CircleGauge size={14} />}
            />
            <DatasetProof
              title="SIMULATION WORKBOOK — .MAT"
              lines={[
                '3,000-sample predictor/response sets for Models 1–3',
                'Loaded via SciPy; exposed in Dataset Explorer',
              ]}
              onClick={() => navigate('explorer')}
              icon={<Timer size={14} />}
            />
          </div>
        </>
      )}
    </div>
  )
}

function utilLevel(v: number | null | undefined): 'healthy' | 'watch' | 'high' | 'critical' | undefined {
  if (v == null) return undefined
  if (v > 95) return 'critical'
  if (v > 85) return 'high'
  if (v >= 70) return 'watch'
  return 'healthy'
}

/** Preview of the Impact page's default assumptions (labelled as assumptions). */
function costPreview(): number {
  return 14 * 1800 + 6.5 * 15000 + 31 * 420
}

function fmtMoneyShort(x: number): string {
  if (x >= 1e7) return `₹${(x / 1e7).toFixed(2)} Cr`
  if (x >= 1e5) return `₹${(x / 1e5).toFixed(1)} L`
  return `₹${Math.round(x).toLocaleString('en-IN')}`
}

function CaseFact({ label, value, tone = 'text-white' }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-sm border border-line bg-ink/50 px-3 py-2.5">
      <p className="font-mono text-[9px] tracking-[0.18em] text-fog">{label}</p>
      <p className={`mt-1 truncate text-sm font-semibold ${tone}`} title={value}>{value}</p>
    </div>
  )
}

function DatasetProof({ title, lines, onClick, icon }: {
  title: string; lines: string[]; onClick: () => void; icon: ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className="group rounded-md border border-line bg-panel/70 p-4 text-left transition-colors hover:border-cyan-dim"
    >
      <p className="flex items-center gap-2 font-mono text-[10px] tracking-[0.16em] text-cyan-300/90">
        {icon} {title}
      </p>
      <ul className="mt-2 space-y-1">
        {lines.map((l) => (
          <li key={l} className="text-[11px] leading-relaxed text-fog">{l}</li>
        ))}
      </ul>
      <p className="mt-2 flex items-center gap-1 font-mono text-[10px] text-fog group-hover:text-cyan-300">
        OPEN EXPLORER <ArrowRight size={10} />
      </p>
    </button>
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
