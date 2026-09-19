// Investigate — the heart of ForgeSite: AI manufacturing investigation workspace.

import { useEffect, useState } from 'react'
import {
  ShieldCheck, GitBranch, ArrowDown, ArrowRight, ArrowUp, FlaskConical,
  Microscope, Link2, TriangleAlert, TrendingDown,
} from 'lucide-react'
import {
  ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis, ZAxis, CartesianGrid, Tooltip,
} from 'recharts'
import { api } from '../services/api'
import { useStore } from '../store'
import { Panel, Chip, StatusBadge, Skeleton, chartTooltipStyle } from '../components/ui'
import { fmtNum, fmtPct, fmtInt } from '../utils/format'

const TIMELINE = [
  { id: 'anomaly', label: 'ANOMALY' },
  { id: 'process', label: 'AFFECTED PROCESS' },
  { id: 'metrics', label: 'RELATED METRICS' },
  { id: 'correlation', label: 'CORRELATION' },
  { id: 'cause', label: 'POSSIBLE CONTRIBUTING FACTOR' },
  { id: 'impact', label: 'OPERATIONAL IMPACT' },
  { id: 'simulation', label: 'SIMULATION' },
]

export function Investigate() {
  const { navigate, logActivity, setSelectedStation } = useStore()
  const [inv, setInv] = useState(null)
  const [matrix, setMatrix] = useState(null)
  const [matrixModel, setMatrixModel] = useState(3)
  const [cell, setCell] = useState(null)
  const [detail, setDetail] = useState(null)
  const [scatter, setScatter] = useState(null)
  const [anoms, setAnoms] = useState(null)
  const [activeStep, setActiveStep] = useState('metrics')
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState(null)

  useEffect(() => {
    let alive = true
    Promise.all([api.investigation(), api.anomalies(), api.correlationMatrix(matrixModel)])
      .then(([i, a, m]) => {
        if (!alive) return
        setInv(i); setAnoms(a); setMatrix(m)
        setLoading(false)
        logActivity('analysis', 'Correlation analysis completed', `matrix over ${m.n?.toLocaleString()} records`)
      })
      .catch((e) => { if (alive) { setErr(e.message); setLoading(false) } })
    return () => { alive = false }
  }, [matrixModel, logActivity])

  const openCell = (c) => {
    setCell(c)
    setDetail(null)
    api.correlationDetail(matrixModel, c.a, c.b, 'pearson', 0)
      .then((d) => {
        setDetail(d)
        setScatter(null)
        // pull a scatter sample for the two variables
        Promise.all([api.series(matrixModel, c.a, 120), api.series(matrixModel, c.b, 120)])
          .then(([sx, sy]) => {
            const n = Math.min(sx.points.length, sy.points.length)
            setScatter(sx.points.slice(0, n).map((p, k) => ({ x: p.v, y: sy.points[k].v })))
          })
          .catch(() => null)
      })
      .catch((e) => setDetail({ available: false, reason: e.message }))
  }

  const affected = inv?.affected_process

  return (
    <div className="space-y-5">
      {/* workspace header */}
      <div className="glass edge-top flex flex-wrap items-center gap-x-8 gap-y-3 px-6 py-5">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-neon/30 to-purple/30 text-cyan glow-neon">
            <ShieldCheck size={20} />
          </span>
          <div>
            <h2 className="text-lg font-semibold text-white tracking-tight">AI FACTORY INVESTIGATION</h2>
            <p className="text-xs text-fog">{inv?.id || '—'} · assembled live from dataset analytics</p>
          </div>
        </div>
        <HeadFact label="Detected anomaly" value={inv?.anomaly?.metric?.replace(/_/g, ' ') || '—'} />
        <HeadFact label="Affected process" value={affected?.name || '—'} />
        <HeadFact label="Time period" value={`${fmtInt(inv?.time_period?.records)} events`} sub={inv?.time_period?.note} />
        <HeadFact label="Severity" value={inv ? <StatusBadge status={inv.severity} /> : '—'} />
        <HeadFact label="Confidence" value={fmtPct(inv?.confidence, 0)} />
      </div>

      {err && <div className="glass border-red/40 px-5 py-4 text-sm text-red">{err}</div>}
      {loading && <Skeleton className="h-64" />}

      {inv && (
        <>
          {/* investigation timeline */}
          <Panel title="Investigation Chain" icon={<GitBranch size={16} />}
            right={<Chip label="click each step" tone="fog" />}>
            <div className="flex flex-wrap items-stretch gap-1.5">
              {TIMELINE.map((t, i) => {
                const active = activeStep === t.id
                return (
                  <div key={t.id} className="flex items-center">
                    <button
                      onClick={() => setActiveStep(t.id)}
                      className={`rounded-lg border px-2.5 py-2 text-[10px] font-semibold tracking-wider transition-all ${
                        active ? 'border-neon/60 bg-neon/15 text-cyan glow-neon' : 'border-line2/70 text-fog hover:text-mist hover:border-neon/40'
                      }`}
                    >
                      {String(i + 1).padStart(2, '0')} {t.label}
                    </button>
                    {i < TIMELINE.length - 1 && <ArrowRight size={11} className="mx-0.5 text-line2" />}
                  </div>
                )
              })}
            </div>
            <div className="mt-4 rounded-xl border border-line bg-navy-850/60 p-4 text-xs leading-relaxed text-mist">
              {stepContent(activeStep, inv, matrix)}
            </div>
          </Panel>

          <div className="grid gap-5 xl:grid-cols-2">
            {/* evidence */}
            <Panel title="Evidence" icon={<Microscope size={16} />} right={<Chip label="DERIVED" tone="cyan" />}>
              <div className="space-y-2.5">
                {inv.evidence.map((e, i) => (
                  <div key={e.label} className="fade-up flex items-center gap-3 rounded-xl border border-line2/60 bg-navy-800/50 px-4 py-3"
                    style={{ animationDelay: `${i * 70}ms` }}>
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-neon/10 text-cyan">
                      <ArrowUp size={15} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-fog">{e.label}</p>
                      <p className="text-[15px] font-semibold text-white">{e.value}</p>
                    </div>
                    <span className="max-w-[190px] text-right text-[10.5px] leading-snug text-fog">{e.vs_fleet}</span>
                  </div>
                ))}
                <p className="pt-1 text-[10.5px] leading-relaxed text-fog">
                  Comparisons are against the median station of the same run set. Associations
                  observed across {fmtInt(inv.time_period?.records)} simulation events.
                </p>
              </div>
            </Panel>

            {/* signals / causal chain */}
            <Panel title="Root-Cause Associations" icon={<Link2 size={16} />}
              right={<Chip label="correlation ≠ causation" tone="amber" />}>
              <CausalChain inv={inv} />
              <div className="mt-4 space-y-2">
                {inv.signals.map((s) => (
                  <div key={s.id} className="rounded-xl border border-line bg-navy-800/40 px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <Chip label={s.kind} tone={s.kind === 'METHODOLOGY' ? 'fog' : 'cyan'} />
                      <p className="text-xs font-semibold text-white">{s.title}</p>
                    </div>
                    <p className="mt-1 text-[11px] leading-relaxed text-fog">{s.detail}</p>
                    <p className="mt-0.5 font-mono text-[9.5px] text-fog/70">source · {s.source}</p>
                  </div>
                ))}
              </div>
            </Panel>
          </div>

          {/* correlation matrix */}
          <Panel
            title="Correlation Matrix" icon={<Link2 size={16} />}
            right={
              <div className="flex items-center gap-1.5">
                {[3, 1, 2].map((m) => (
                  <button key={m} onClick={() => setMatrixModel(m)}
                    className={`rounded-md border px-2.5 py-1 text-[10.5px] font-semibold transition-colors ${
                      matrixModel === m ? 'border-neon/60 bg-neon/15 text-cyan' : 'border-line2 text-fog hover:text-mist'
                    }`}>Model {m}</button>
                ))}
              </div>
            }
          >
            {matrix ? (
              <div className="grid gap-5 lg:grid-cols-5">
                <div className="lg:col-span-3 overflow-x-auto">
                  <p className="mb-2 text-[10.5px] text-fog">
                    Pearson r over {fmtInt(matrix.n)} records · click a cell for detail
                  </p>
                  <table className="border-separate border-spacing-1">
                    <thead>
                      <tr>
                        <th />
                        {matrix.variables_short.map((v) => (
                          <th key={v} className="max-w-[64px] truncate pb-1 text-[9px] font-medium text-fog" title={v}>
                            {v.split(' ')[0]}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {matrix.variables_short.map((rv, i) => (
                        <tr key={rv}>
                          <td className="max-w-[90px] truncate pr-1 text-right text-[9.5px] text-fog" title={rv}>{rv}</td>
                          {matrix.variables_short.map((cv, j) => {
                            const c = matrix.cells.find((x) => x.i === i && x.j === j)
                            if (!c) return null
                            const alpha = Math.min(1, Math.abs(c.r || 0))
                            const bg = c.i === c.j ? 'rgba(79,124,255,0.10)'
                              : c.r >= 0 ? `rgba(79,124,255,${alpha * 0.75})` : `rgba(244,80,108,${alpha * 0.75})`
                            return (
                              <td key={cv}>
                                <button
                                  onClick={() => openCell(c)}
                                  className="h-9 w-14 rounded-md border border-line/60 text-[10px] font-semibold text-white/90 transition-transform hover:scale-105"
                                  style={{ background: bg }}
                                  title={`${c.a} ↔ ${c.b}: r=${c.r?.toFixed?.(2)}`}
                                >
                                  {c.r?.toFixed(2).replace('0.', '.')}
                                </button>
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="lg:col-span-2">
                  {cell ? (
                    <div className="rounded-xl border border-line bg-navy-800/50 p-4">
                      <p className="text-xs font-semibold text-white">{cell.a_short} ↔ {cell.b_short}</p>
                      {detail?.available ? (
                        <>
                          <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                            <Fact label="Correlation" value={fmtNum(detail.r, 3)} />
                            <Fact label="p-value" value={detail.p_value != null ? detail.p_value.toExponential(1) : '—'} />
                            <Fact label="Sample size" value={fmtInt(detail.n)} />
                            <Fact label="95% CI" value={detail.ci95 ? `[${fmtNum(detail.ci95[0], 2)}, ${fmtNum(detail.ci95[1], 2)}]` : '—'} />
                          </div>
                          <p className="mt-2.5 rounded-lg border border-amber/25 bg-amber/5 px-3 py-2 text-[11px] leading-relaxed text-amber/90">
                            {detail.interpretation}
                          </p>
                          {scatter && (
                            <div className="mt-3 h-36">
                              <ResponsiveContainer width="100%" height="100%">
                                <ScatterChart margin={{ top: 4, right: 6, left: -18, bottom: 0 }}>
                                  <CartesianGrid stroke="#1c2444" strokeDasharray="3 6" />
                                  <XAxis dataKey="x" type="number" tick={{ fill: '#7d8bb0', fontSize: 8 }} stroke="#293357" />
                                  <YAxis dataKey="y" type="number" tick={{ fill: '#7d8bb0', fontSize: 8 }} stroke="#293357" width={40} />
                                  <ZAxis range={[12, 12]} />
                                  <Tooltip contentStyle={chartTooltipStyle()} />
                                  <Scatter data={scatter} fill="#38d9f5" fillOpacity={0.55} />
                                </ScatterChart>
                              </ResponsiveContainer>
                            </div>
                          )}
                        </>
                      ) : detail ? (
                        <p className="mt-2 text-xs text-amber">{detail.reason}</p>
                      ) : (
                        <Skeleton className="mt-2 h-24" />
                      )}
                    </div>
                  ) : (
                    <div className="grid h-full place-items-center rounded-xl border border-dashed border-line2 p-6 text-center text-xs text-fog">
                      Click any matrix cell to inspect correlation, p-value, sample size and interpretation.
                    </div>
                  )}
                </div>
              </div>
            ) : <Skeleton className="h-64" />}
          </Panel>

          {/* anomaly registry */}
          <Panel title="Anomaly Registry" icon={<TriangleAlert size={16} />}
            right={<Chip label={`${anoms?.scan?.length || 0} metrics scanned`} tone="fog" />}>
            {anoms ? (
              <div className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-3">
                {anoms.scan.slice(0, 9).map((s) => (
                  <div key={s.metric} className={`rounded-xl border px-4 py-3 ${
                    s.severity === 'CRITICAL' ? 'border-red/40 bg-red/5' : 'border-amber/40 bg-amber/5'
                  }`}>
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-xs font-semibold text-white">{s.metric.replace(/_/g, ' ')}</p>
                      <StatusBadge status={s.severity} />
                    </div>
                    <p className="mt-1 text-[10.5px] text-fog">
                      {fmtInt(s.n_anomalies)} outliers · {fmtNum(s.anomaly_rate_pct, 2)}% of {fmtInt(s.n_total)} · {s.method}
                    </p>
                    <div className="mt-2 flex items-center justify-between text-[10px] text-fog">
                      <span>expected {fmtNum(s.samples[0]?.expected_low, 1)}–{fmtNum(s.samples[0]?.expected_high, 1)}</span>
                      <span className="text-red">observed {fmtNum(s.samples[0]?.observed, 1)}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : <Skeleton className="h-40" />}
          </Panel>

          <div className="flex flex-wrap justify-end gap-2">
            <button
              onClick={() => { setSelectedStation(affected?.id); navigate('flow') }}
              className="flex items-center gap-2 rounded-lg border border-line2 px-4 py-2 text-xs font-semibold text-mist hover:border-neon/50 hover:text-white"
            >
              <GitBranch size={13} /> Open affected process in flow
            </button>
            <button
              onClick={() => navigate('simulate')}
              className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-neon to-purple px-4 py-2 text-xs font-semibold text-white glow-neon"
            >
              <FlaskConical size={13} /> Continue to What-If Lab <ArrowRight size={12} />
            </button>
          </div>
        </>
      )}
    </div>
  )
}

function stepContent(step, inv, matrix) {
  const ap = inv.affected_process
  switch (step) {
    case 'anomaly':
      return inv.anomaly
        ? `ANOMALY — ${inv.anomaly.metric} breached its expected range (${fmtNum(inv.anomaly.samples[0]?.expected_low, 1)}–${fmtNum(inv.anomaly.samples[0]?.expected_high, 1)}) with observed values near ${fmtNum(inv.anomaly.samples[0]?.observed, 1)} (${inv.anomaly.method} method, ${fmtInt(inv.anomaly.n_anomalies)} outlier events).`
        : 'No dominant anomaly in the current scan.'
    case 'process':
      return `AFFECTED PROCESS — ${ap.name} carries the strongest multi-signal constraint: ForgeSite Bottleneck Score ${fmtNum(ap.bottleneck_score, 0)}/100. The score blends utilization, queue, waiting and cycle signals (weights configurable in the backend).`
    case 'metrics':
      return `RELATED METRICS — utilization ${fmtPct(inv.evidence[0]?.value)}, queue ${inv.evidence[1]?.value}, peak p95 ${inv.evidence[2]?.value}. Every figure is computed from Model 3 fields named in the evidence cards.`
    case 'correlation':
      return matrix
        ? `CORRELATION — the matrix below quantifies ${matrix.cells.length / (matrix.variables.length * matrix.variables.length) === 1 ? '' : ''}pairwise Pearson relationships over ${fmtInt(matrix.n)} records. Strong pairs: ${matrix.cells.filter((c) => c.i < c.j && Math.abs(c.r || 0) > 0.5).slice(0, 3).map((c) => `${c.a_short} ↔ ${c.b_short} (r=${c.r})`).join(', ') || 'none above |0.5|'}.`
        : 'Correlation matrix loading…'
    case 'cause':
      return `POSSIBLE CONTRIBUTING FACTOR — material-flow accumulation at ${ap.name} is associated with downstream waiting. Language is deliberately cautious: the dataset shows statistical association, and causation requires validation against process records.`
    case 'impact':
      return `OPERATIONAL IMPACT — queue accumulation and waiting reduce effective throughput (${fmtInt(inv.evidence[4]?.value)} products/run mean). Quantified projections are on the Simulate page, labelled PROJECTED.`
    case 'simulation':
      return 'SIMULATION — the What-If Lab projects throughput, queue, waiting and utilization responses to cycle-time/capacity changes, using the Theory-of-Constraints-damped capacity model. All outputs are labelled PROJECTED.'
    default:
      return ''
  }
}

function CausalChain({ inv }) {
  const ap = inv.affected_process
  const chain = [
    { icon: <ArrowUp size={13} />, label: `Queue accumulation at ${ap.name}` },
    { icon: <ArrowDown size={13} />, label: 'Material flow delay upstream' },
    { icon: <ArrowDown size={13} />, label: 'Downstream waiting time increase' },
    { icon: <TrendingDown size={13} />, label: 'Reduced effective throughput (observed association)' },
  ]
  return (
    <div className="space-y-1.5">
      {chain.map((c, i) => (
        <div key={i}>
          <div className={`flex items-center gap-2.5 rounded-lg border px-3.5 py-2.5 text-xs ${
            i === chain.length - 1 ? 'border-red/35 bg-red/5 text-red' : 'border-line2/70 bg-navy-800/50 text-mist'
          }`}>
            <span className={i === chain.length - 1 ? 'text-red' : 'text-cyan'}>{c.icon}</span>
            {c.label}
          </div>
          {i < chain.length - 1 && <ArrowDown size={11} className="ml-5 my-0.5 text-line2" />}
        </div>
      ))}
      <p className="pt-1 text-[10.5px] italic leading-relaxed text-fog">
        Observed relationships across simulation runs — "strong association / possible
        contributor", requires validation. Not proven causation.
      </p>
    </div>
  )
}

function HeadFact({ label, value, sub }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] uppercase tracking-wider text-fog">{label}</p>
      <p className="truncate text-sm font-semibold text-white">{value}</p>
      {sub && <p className="max-w-[240px] truncate text-[9.5px] text-fog/80" title={sub}>{sub}</p>}
    </div>
  )
}

function Fact({ label, value }) {
  return (
    <div className="rounded-lg border border-line bg-navy-850/70 px-2.5 py-1.5">
      <p className="text-[9.5px] text-fog">{label}</p>
      <p className="font-mono text-xs font-semibold text-white">{value}</p>
    </div>
  )
}
