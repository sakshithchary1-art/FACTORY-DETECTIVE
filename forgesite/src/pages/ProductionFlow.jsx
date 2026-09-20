// Production — plant process diagram + station detail from real Model 3 data.
// Nodes are engineering diagram tiles: name, usage, waiting, status.

import { useEffect, useState } from 'react'
import { GitBranch, ArrowRight, X } from 'lucide-react'
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, BarChart, Bar,
} from 'recharts'
import { api } from '../services/api'
import { useStore } from '../store'
import { Panel, Chip, StatusBadge, Skeleton, SectionTitle, CHART, chartTooltipStyle } from '../components/ui'
import { CircularProgress, LoadingLine, Term, MiniRing } from '../components/Feedback'
import { fmtInt, fmtCompact, fmtNum, fmtPct } from '../utils/format'

function utilStatus(u) {
  if (u == null) return 'WATCH'
  if (u >= 95) return 'CRITICAL'
  if (u >= 85) return 'WARNING'
  if (u >= 70) return 'WATCH'
  return 'HEALTHY'
}

export function ProductionFlow() {
  const { selectedStation, setSelectedStation, navigate } = useStore()
  const [stations, setStations] = useState(null)
  const [detail, setDetail] = useState(null)
  const [flow, setFlow] = useState(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState(null)

  useEffect(() => {
    Promise.all([api.stations(), api.kpis().catch(() => null)])
      .then(([s, k]) => { setStations(s.stations); setFlow(k?.flow_progress || null); setLoading(false) })
      .catch((e) => { setErr(e.message); setLoading(false) })
  }, [])

  useEffect(() => {
    if (!selectedStation) { setDetail(null); return }
    setDetail(null)
    api.stationDetail(selectedStation)
      .then(setDetail)
      .catch((e) => setDetail({ error: e.message }))
  }, [selectedStation])

  const byId = new Map((stations || []).map((s) => [s.id, s]))
  const sel = selectedStation ? byId.get(selectedStation) : null
  const selDetail = detail?.station

  return (
    <div className="space-y-6">
      <SectionTitle
        title="Production"
        note="Raw material → Blanking → Press → Assembly → Paint → Quality · every value from the Detailed Factory Data"
        right={<Chip label="DERIVED · 605,620 EVENTS" tone="cyan" />}
      />

      {err && <div className="glass border-red/40 px-4 py-3 text-[13px] text-red">{err}</div>}
      {loading && <LoadingLine label="Loading production data" className="max-w-md pt-2" />}

      {stations && (
        <Panel
          title="Plant Process Map"
          right={
            <div className="hidden items-center gap-3 text-[10px] text-fog md:flex">
              <span className="flex items-center gap-1"><i className="h-1.5 w-1.5 rounded-full" style={{ background: '#405443' }} />&lt;70%</span>
              <span className="flex items-center gap-1"><i className="h-1.5 w-1.5 rounded-full" style={{ background: '#A88952' }} />70–85%</span>
              <span className="flex items-center gap-1"><i className="h-1.5 w-1.5 rounded-full" style={{ background: '#A6622B' }} />85–95%</span>
              <span className="flex items-center gap-1"><i className="h-1.5 w-1.5 rounded-full" style={{ background: '#6E3B42' }} />≥95%</span>
            </div>
          }
        >
          <PlantMap stations={byId} selected={selectedStation} onSelect={setSelectedStation} />
          {flow?.overall != null && (
            <div className="mt-3 border-t border-line pt-2.5">
              <div className="mb-1.5 flex items-baseline justify-between gap-3 text-[11px]">
                <span className="font-medium text-mist">Flow progressing normally</span>
                <span className="tnum font-mono font-semibold text-ink">{fmtNum(flow.overall, 1)}%</span>
              </div>
              <div className="h-[5px] w-full overflow-hidden rounded-full bg-[#E8E2D6]">
                <div className="h-full rounded-full bg-navy transition-[width] duration-700 ease-out" style={{ width: `${flow.overall}%` }} />
              </div>
              <div className="mt-2.5 grid grid-cols-2 gap-x-5 gap-y-2 sm:grid-cols-3 xl:grid-cols-4">
                {flow.stages.map((s) => (
                  <div key={s.id}>
                    <div className="flex items-baseline justify-between gap-2 text-[10.5px]">
                      <span className="truncate text-fog">{s.name}</span>
                      <span className="tnum font-mono text-mist">{fmtNum(s.flow_pct, 0)}%</span>
                    </div>
                    <div className="mt-0.5 h-[3px] w-full overflow-hidden rounded-full bg-[#E8E2D6]">
                      <div className="h-full rounded-full bg-navy/70 transition-[width] duration-500" style={{ width: `${s.flow_pct}%` }} />
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-[10px] leading-relaxed text-fog">
                Derived flow health — mean of congestion-free share (event samples with empty queue)
                and machine readiness (100 − machine usage). Not a job-completion percentage.
              </p>
            </div>
          )}
        </Panel>
      )}

      {/* station detail — side-panel style */}
      {selectedStation && sel && (
        <Panel
          title={`Station Detail — ${selDetail?.name || sel.name}`}
          right={<button onClick={() => setSelectedStation(null)} className="text-fog hover:text-ink" aria-label="Close"><X size={13} /></button>}
        >
          {detail === null ? (
            <div className="space-y-4">
              <LoadingLine label="Reading station data" />
              <Skeleton className="h-48" />
            </div>
          ) : detail.error ? (
            <p className="text-[12px] text-red">{detail.error}</p>
          ) : (
            <div className="grid gap-5 lg:grid-cols-2">
              <div className="space-y-4">
                <div className="flex items-center gap-4 border-b border-line pb-4">
                  <CircularProgress
                    value={selDetail?.utilization ?? 0}
                    size={84}
                    status={selDetail?.utilization >= 95 ? 'critical' : selDetail?.utilization >= 85 ? 'warning' : selDetail?.utilization >= 70 ? 'normal' : 'healthy'}
                    label="Machine Usage"
                  />
                  <div>
                    <StatusBadge status={utilStatus(selDetail?.utilization)} />
                    <p className="mt-1 text-[11px] leading-relaxed text-fog">
                      Bands: &lt;70% normal · 70–85% watch · 85–95% attention · ≥95% critical
                    </p>
                  </div>
                </div>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 sm:grid-cols-3">
                  <Stat label={<Term tech="Utilization">Machine Usage</Term>} value={fmtPct(selDetail?.utilization)} />
                  <Stat label="Usage p95" value={fmtPct(selDetail?.utilization_p95)} />
                  <Stat label={<Term tech="Queue time">Waiting</Term>} value={selDetail?.queue_mean != null ? fmtNum(selDetail.queue_mean, 1) : 'no data'} />
                  <Stat label="Waiting p95" value={selDetail?.queue_p95 != null ? fmtNum(selDetail.queue_p95, 1) : '—'} />
                  <Stat label={<Term tech="Cycle time">Cycle</Term>} value={selDetail?.cycle_mean != null ? fmtCompact(selDetail.cycle_mean) : 'n/a'} sub={selDetail?.cycle_mean != null ? 'c_Cycle (event units)' : undefined} />
                  <Stat label="Waiting minutes" value={selDetail?.wait_mean != null ? fmtNum(selDetail.wait_mean, 2) : 'n/a'} />
                </dl>
                {Object.keys(detail.sku_counters || {}).length > 0 && (
                  <div>
                    <p className="mb-1.5 text-[10px] tracking-[0.07em] text-fog uppercase">
                      <Term tech={`Technical fields: ${Object.values(detail.sku_counters)[0]?.column} family`}>Product Type output</Term> · mean per run
                    </p>
                    <div className="h-28">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={Object.entries(detail.sku_counters).map(([k, v]) => ({ sku: k, units: v.mean }))}
                          margin={{ top: 4, right: 4, left: -20, bottom: 0 }}
                        >
                          <CartesianGrid stroke={CHART.grid} strokeDasharray="2 4" vertical={false} />
                          <XAxis dataKey="sku" tick={CHART.tick} stroke={CHART.axis} />
                          <YAxis tick={CHART.tick} stroke={CHART.axis} width={38} tickFormatter={(v) => fmtCompact(v, '')} />
                          <Tooltip contentStyle={chartTooltipStyle()} formatter={(v) => [fmtInt(v), 'units']} />
                          <Bar dataKey="units" fill={CHART.series.blue} radius={[3, 3, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}
                <button
                  onClick={() => navigate('simulate')}
                  className="btn-primary flex w-full items-center justify-center gap-1.5 py-2 text-[11.5px] font-semibold"
                >
                  TRY A CHANGE AT THIS STATION <ArrowRight size={11} />
                </button>
              </div>

              <div className="space-y-4">
                {detail.series?.utilization?.available && (
                  <div>
                    <p className="mb-1 flex items-center justify-between text-[10px] tracking-[0.07em] text-fog uppercase">
                      <span>Machine usage trend</span>
                      <span className="font-mono normal-case tracking-normal">{detail.series.utilization.column}</span>
                    </p>
                    <div style={{ height: 168 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={detail.series.utilization.points} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
                          <defs>
                            <linearGradient id="uGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor={CHART.series.cyan} stopOpacity={0.16} />
                              <stop offset="100%" stopColor={CHART.series.cyan} stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid stroke={CHART.grid} strokeDasharray="2 4" vertical={false} />
                          <XAxis dataKey="t" tick={CHART.tick} stroke={CHART.axis} minTickGap={56} tickFormatter={(v) => fmtCompact(v, '')} />
                          <YAxis tick={CHART.tick} stroke={CHART.axis} width={38} tickFormatter={(v) => v.toFixed(1)} domain={[0, 1]} />
                          <Tooltip contentStyle={chartTooltipStyle()} labelFormatter={(v) => `Event #${fmtInt(v)}`} formatter={(v) => [fmtPct(v * 100, 1), 'machine usage']} />
                          <Area type="monotone" dataKey="v" stroke={CHART.series.cyan} strokeWidth={1.5} fill="url(#uGrad)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}
                {detail.series?.queue?.available && (
                  <div>
                    <p className="mb-1 flex items-center justify-between text-[10px] tracking-[0.07em] text-fog uppercase">
                      <span>Waiting trend</span>
                      <span className="font-mono normal-case tracking-normal">{detail.series.queue.column}</span>
                    </p>
                    <div style={{ height: 152 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={detail.series.queue.points} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
                          <defs>
                            <linearGradient id="qGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor={CHART.series.purple} stopOpacity={0.16} />
                              <stop offset="100%" stopColor={CHART.series.purple} stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid stroke={CHART.grid} strokeDasharray="2 4" vertical={false} />
                          <XAxis dataKey="t" tick={CHART.tick} stroke={CHART.axis} minTickGap={56} tickFormatter={(v) => fmtCompact(v, '')} />
                          <YAxis tick={CHART.tick} stroke={CHART.axis} width={38} tickFormatter={(v) => fmtCompact(v, '')} />
                          <Tooltip contentStyle={chartTooltipStyle()} labelFormatter={(v) => `Event #${fmtInt(v)}`} formatter={(v) => [fmtNum(v, 1), 'units']} />
                          <Area type="monotone" dataKey="v" stroke={CHART.series.purple} strokeWidth={1.5} fill="url(#qGrad)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </Panel>
      )}
    </div>
  )
}

function Stat({ label, value, sub }) {
  return (
    <div>
      <dt className="text-[9.5px] tracking-[0.07em] text-fog uppercase">{label}</dt>
      <dd className="tnum mt-0.5 font-mono text-[15px] font-semibold text-ink">{value}</dd>
      {sub && <dd className="text-[9.5px] text-fog/80">{sub}</dd>}
    </div>
  )
}

function PlantMap({ stations, selected, onSelect }) {
  const utilColor = (u) => (u == null ? '#8B8578' : u >= 95 ? '#6E3B42' : u >= 85 ? '#A6622B' : u >= 70 ? '#A88952' : '#405443')

  const Node = ({ id, x, y, w = 108, h = 54, label }) => {
    const s = stations.get(id)
    if (!s) return null
    const color = utilColor(s.utilization)
    const isSel = selected === id
    return (
      <g onClick={() => onSelect(id)} className="cursor-pointer">
        <rect x={x} y={y} width={w} height={h} rx={6}
          fill={isSel ? 'rgba(38,54,74,0.06)' : '#FFFFFF'}
          stroke={isSel ? '#26364A' : color} strokeWidth={isSel ? 1.8 : 1.1}
          className={isSel ? '' : 'transition-all hover:stroke-[#8B8578]'} />
        <text x={x + w / 2} y={y + 16} textAnchor="middle" fontSize={10} fontWeight={700} fill="#252525" fontFamily="Inter, sans-serif">
          {label || s.name}
        </text>
        <text x={x + w / 2} y={y + 31} textAnchor="middle" fontSize={9.5} fill={color} fontFamily="JetBrains Mono, monospace">
          {s.utilization != null ? `${s.utilization.toFixed(1)}% usage` : 'usage n/a'}
        </text>
        <text x={x + w / 2} y={y + 44} textAnchor="middle" fontSize={8.5} fill="#5F6670" fontFamily="JetBrains Mono, monospace">
          {s.queue_mean != null ? `waiting ${s.queue_mean.toFixed(1)}` : '—'}
        </text>
        {s.utilization >= 85 && (
          <circle cx={x + w - 8} cy={y + 8} r={3.5} fill="#6E3B42" className="pulse-soft" />
        )}
      </g>
    )
  }

  const Flow = ({ d }) => (
    <path d={d} fill="none" stroke="#D8D2C8" strokeWidth={1.2} className="flow-line" />
  )

  return (
    <div className="overflow-x-auto">
      <svg viewBox="0 0 1000 470" className="mx-auto block h-auto w-full min-w-[860px]">
        {/* raw material — sits above the Blanking node, connected by a short flow line */}
        <g>
          <rect x={47} y={8} width={64} height={38} rx={6} fill="#F1EDE4" stroke="#D8D2C8" />
          <text x={79} y={31} textAnchor="middle" fontSize={9} fill="#5F6670" fontFamily="Inter">RAW</text>
          <Flow d="M 79 46 L 79 66 L 64 66 L 64 100" />
        </g>

        <Node id="BLANKING" x={10} y={102} w={108} h={54} label="Blanking" />
        <Flow d="M 118 156 L 118 196" />

        {/* presses */}
        {[1, 2, 3, 4].map((i) => {
          const x = 66 + (i - 1) * 150
          return (
            <g key={`p${i}`}>
              <Flow d={`M 64 156 L 64 186 L ${x + 54} 186 L ${x + 54} 208`} />
              <Node id={`PRESS${i}`} x={x} y={208} w={108} h={54} label={`Press ${i}`} />
              <Flow d={`M ${x + 54} 262 L ${x + 54} 296`} />
            </g>
          )
        })}
        <line x1={120} y1={296} x2={570} y2={296} stroke="#D8D2C8" strokeWidth={1.2} />

        {/* cells */}
        {[1, 2, 3, 4].map((i) => {
          const x = 96 + (i - 1) * 132
          return (
            <g key={`c${i}`}>
              <Flow d={`M 490 296 L ${x + 50} 296 L ${x + 50} 318`} />
              <Node id={`CELL${i}`} x={x} y={318} w={100} h={54} label={`Cell ${i}`} />
              <Flow d={`M ${x + 50} 372 L ${x + 50} 402`} />
            </g>
          )
        })}
        <line x1={146} y1={402} x2={492} y2={402} stroke="#D8D2C8" strokeWidth={1.2} />
        <Flow d="M 490 402 L 620 402 L 620 430" />

        {/* paint */}
        <Node id="PAINT1" x={614} y={318} w={100} h={50} label="Paint 1" />
        <Node id="PAINT2" x={726} y={318} w={100} h={50} label="Paint 2" />
        <Flow d="M 714 343 L 726 343" />
        <Flow d="M 776 368 L 776 396" />

        {/* quality */}
        <Node id="QUALITY" x={776} y={396} w={104} h={54} />

        {/* forklift rail */}
        <Flow d="M 240 318 L 720 318 L 720 210" />
        <Node id="FORKLIFT" x={666} y={148} w={108} h={54} label="Forklift Fleet" />
        <text x={720} y={138} textAnchor="middle" fontSize={8.5} fill="#5F6670" fontFamily="Inter">MATERIAL HANDLING</text>
        <Flow d="M 774 175 L 850 175" />          <text x={905} y={179} textAnchor="middle" fontSize={9} fill="#5F6670" fontFamily="Inter">→ PAINT</text>

        {/* finished goods */}
        <g>
          <rect x={880} y={408} width={70} height={48} rx={6} fill="#F1EDE4" stroke="#D8D2C8" />
          <text x={915} y={435} textAnchor="middle" fontSize={9} fill="#5F6670" fontFamily="Inter">FINISHED</text>
        </g>
        <Flow d="M 842 424 L 880 430" />
      </svg>
    </div>
  )
}
