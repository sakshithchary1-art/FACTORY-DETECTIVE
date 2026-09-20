// Find the Cause — FORGE SIGHT investigation workspace.
// Engineering-investigation layout: issue header → evidence chain → matrix.

import { useEffect, useState } from 'react'
import {
  GitBranch, ArrowDown, ArrowRight, ArrowUp, FlaskConical,
  TriangleAlert, TrendingDown,
} from 'lucide-react'
import {
  ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis, ZAxis, CartesianGrid, Tooltip,
} from 'recharts'
import { api } from '../services/api'
import { useStore } from '../store'
import { Panel, Chip, StatusBadge, Skeleton, SectionTitle, CHART, chartTooltipStyle } from '../components/ui'
import { CircularProgress, LoadingLine, Term } from '../components/Feedback'
import { ModelPicker } from '../components/DataTransparency'
import { fmtNum, fmtPct, fmtInt, fmtCompact } from '../utils/format'

// Short factual chain labels.
const TIMELINE = [
  { id: 'anomaly', label: 'PROBLEM' },
  { id: 'process', label: 'STATION' },
  { id: 'metrics', label: 'EVIDENCE' },
  { id: 'correlation', label: 'SIGNALS' },
  { id: 'cause', label: 'POSSIBLE CAUSE' },
  { id: 'impact', label: 'EFFECT' },
  { id: 'simulation', label: 'WHAT-IF' },
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
        logActivity('analysis', 'Relationship analysis completed', `matrix over ${m.n?.toLocaleString()} records`)
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
  const conf = inv?.confidence ?? 0
  const confStatus = conf >= 75 ? 'healthy' : conf >= 55 ? 'normal' : conf >= 35 ? 'warning' : 'critical'

  return (
    <div className="space-y-6">
      {/* current issue header — a flat strip, not a hero card */}
      <div className="border-b border-line pb-4">
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
          <div>
            <h2 className="text-[17px] font-semibold tracking-tight text-ink">Find the Cause</h2>
            <p className="mt-0.5 text-[11.5px] text-fog">
              {inv ? `${inv.id} · assembled live from dataset analytics` : 'Assembling from dataset analytics'}
            </p>
          </div>
          {inv && <StatusBadge status={inv.severity} />}
        </div>
        {inv && (
          <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-4">
            <HeadFact label="Problem" value={inv?.anomaly?.metric?.replace(/_/g, ' ') || '—'} />
            <HeadFact label="Affected station" value={affected?.name || '—'} />
            <HeadFact label="Time period" value={`${fmtCompact(inv?.time_period?.records, '—')} events`} sub={inv?.time_period?.note} />
            <HeadFact label={<Term tech="Agreement across independent evidence signals">Evidence confidence</Term>} value={fmtPct(inv.confidence, 0)} />
          </dl>
        )}
      </div>

      {err && <div className="glass border-red/40 px-4 py-3 text-[13px] text-red">{err}</div>}
      {loading && <LoadingLine label="Preparing investigation" className="max-w-md pt-2" />}

      {inv && (
        <>
          {/* evidence chain */}
          <section>
            <SectionTitle title="Evidence Chain" note="Each step is clickable — short factual statements, no interpretation" />
            <div className="glass p-4">
              <div className="flex flex-wrap items-center gap-1">
                {TIMELINE.map((t, i) => {
                  const active = activeStep === t.id
                  return (
                    <div key={t.id} className="flex items-center">
                      <button
                        onClick={() => setActiveStep(t.id)}
                        className={`rounded-md border px-2 py-1 text-[10px] font-semibold tracking-[0.06em] transition-colors ${
                          active ? 'border-neon/50 bg-neon/[0.06] text-neon' : 'border-line2 text-fog hover:text-mist'
                        }`}
                      >
                        {String(i + 1).padStart(2, '0')} {t.label}
                      </button>
                      {i < TIMELINE.length - 1 && <ArrowRight size={10} className="mx-1 text-line2" />}
                    </div>
                  )
                })}
              </div>
              <p className="mt-3 border-t border-line pt-3 text-[12px] leading-relaxed text-mist">
                {stepContent(activeStep, inv, matrix)}
              </p>
            </div>
          </section>

          {/* evidence + causes */}
          <div className="grid gap-4 xl:grid-cols-2">
            <Panel title="Evidence" right={<Chip label="DERIVED" tone="cyan" />}>
              <div className="mb-3 flex items-center gap-4">
                <CircularProgress value={conf} size={72} status={confStatus} label="Confidence" />
                <p className="text-[11px] leading-relaxed text-fog">
                  Agreement across independent signals — built from the dataset, not a
                  validated classifier score.
                </p>
              </div>
              <ul className="divide-y divide-line">
                {inv.evidence.map((e) => (
                  <li key={e.label} className="flex items-baseline justify-between gap-3 py-[7px]">
                    <span className="min-w-0 truncate text-[12px] text-mist">{e.label}</span>
                    <span className="flex shrink-0 items-baseline gap-2">
                      <span className="tnum text-[13px] font-semibold text-ink">{e.value}</span>
                      <span className="hidden text-[10px] text-fog md:inline">{e.vs_fleet}</span>
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 border-t border-line pt-2 text-[10.5px] leading-relaxed text-fog">
                Comparisons are against the median station of the same run set, across{' '}
                {fmtInt(inv.time_period?.records)} simulation events.
              </p>
            </Panel>

            <Panel title="Possible Cause" right={<Chip label="correlation ≠ causation" tone="amber" />}>
              <CausalChain inv={inv} />
              <ul className="mt-3 divide-y divide-line border-t border-line">
                {inv.signals.map((s) => (
                  <li key={s.id} className="py-2">
                    <div className="flex items-center gap-2">
                      <Chip label={s.kind} tone={s.kind === 'METHODOLOGY' ? 'fog' : 'cyan'} />
                      <p className="text-[12px] font-semibold text-ink">{s.title}</p>
                    </div>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-fog">{s.detail}</p>
                    <p className="mt-0.5 font-mono text-[9.5px] text-fog/70">source · {s.source}</p>
                  </li>
                ))}
              </ul>
            </Panel>
          </div>

          {/* signals matrix */}
          <Panel
            title={<Term tech="Pearson correlation matrix — statistical association, not causation">Signal Relationships</Term>}
            right={<ModelPicker value={matrixModel} onChange={setMatrixModel} />}
          >
            {matrix ? (
              <div className="grid gap-4 lg:grid-cols-5">
                <div className="overflow-x-auto lg:col-span-3">
                  <p className="mb-2 text-[10.5px] text-fog">
                    Association strength over {fmtInt(matrix.n)} records · click a cell for detail
                  </p>
                  <table className="border-separate border-spacing-[3px]">
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
                          <td className="max-w-[90px] truncate pr-1.5 text-right text-[9.5px] text-fog" title={rv}>{rv}</td>
                          {matrix.variables_short.map((cv, j) => {
                            const c = matrix.cells.find((x) => x.i === i && x.j === j)
                            if (!c) return null
                            const alpha = Math.min(1, Math.abs(c.r || 0))
                            const bg = c.i === c.j ? 'rgba(38,54,74,0.08)'
                              : c.r >= 0 ? `rgba(38,54,74,${alpha * 0.7})` : `rgba(110,59,66,${alpha * 0.7})`
                            return (
                              <td key={cv}>
                                <button
                                  onClick={() => openCell(c)}
                                  className="h-8 w-12 rounded border border-line/60 text-[10px] font-semibold transition-transform hover:scale-105"
                                  style={{ background: bg, color: alpha > 0.45 ? '#FCFBF8' : '#252525' }}
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
                    <div className="rounded-lg border border-line bg-navy-800 p-3.5">
                      <p className="text-[12px] font-semibold text-ink">{cell.a_short} ↔ {cell.b_short}</p>
                      {detail?.available ? (
                        <>
                          <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11.5px]">
                            <Fact label="Association" value={fmtNum(detail.r, 2)} />
                            <Fact label={<Term tech="Statistical significance">p-value</Term>} value={detail.p_value != null ? detail.p_value.toExponential(1) : '—'} />
                            <Fact label="Sample size" value={fmtCompact(detail.n)} />
                            <Fact label="95% range" value={detail.ci95 ? `[${fmtNum(detail.ci95[0], 2)}, ${fmtNum(detail.ci95[1], 2)}]` : '—'} />
                          </dl>
                          <p className="mt-2.5 border-l-2 border-amber/50 bg-amber/[0.05] px-2.5 py-1.5 text-[11px] leading-relaxed text-amber">
                            {detail.interpretation}
                          </p>
                          {scatter && (
                            <div className="mt-3 h-32">
                              <ResponsiveContainer width="100%" height="100%">
                                <ScatterChart margin={{ top: 4, right: 6, left: -14, bottom: 0 }}>
                                  <CartesianGrid stroke={CHART.grid} strokeDasharray="2 4" />
                                  <XAxis dataKey="x" type="number" tick={CHART.tick} stroke={CHART.axis} />
                                  <YAxis dataKey="y" type="number" tick={CHART.tick} stroke={CHART.axis} width={38} />
                                  <ZAxis range={[11, 11]} />
                                  <Tooltip contentStyle={chartTooltipStyle()} />
                                  <Scatter data={scatter} fill={CHART.series.cyan} fillOpacity={0.55} />
                                </ScatterChart>
                              </ResponsiveContainer>
                            </div>
                          )}
                        </>
                      ) : detail ? (
                        <p className="mt-2 text-[11.5px] text-amber">{detail.reason}</p>
                      ) : (
                        <Skeleton className="mt-2 h-20" />
                      )}
                    </div>
                  ) : (
                    <div className="grid h-full place-items-center rounded-lg border border-dashed border-line2 p-5 text-center text-[11.5px] text-fog">
                      Click any cell to inspect the relationship, p-value, sample size and a cautious interpretation.
                    </div>
                  )}
                </div>
              </div>
            ) : <Skeleton className="h-60" />}
          </Panel>

          {/* unusual readings — flat table-style list */}
          <Panel title="Unusual Readings" right={<span className="text-[11px] text-fog">{anoms?.scan?.length || 0} metrics scanned</span>}>
            {anoms ? (
              <ul className="divide-y divide-line">
                {anoms.scan.slice(0, 6).map((s) => (
                  <li key={s.metric} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <StatusBadge status={s.severity} />
                      <span className="truncate text-[12.5px] font-medium text-ink">{s.metric.replace(/_/g, ' ')}</span>
                    </div>
                    <div className="tnum flex items-baseline gap-4 text-[11px] text-fog">
                      <span>expected {fmtNum(s.samples[0]?.expected_low, 1)}–{fmtNum(s.samples[0]?.expected_high, 1)}</span>
                      <span className="font-semibold text-red">observed {fmtNum(s.samples[0]?.observed, 1)}</span>
                      <span className="hidden md:inline">{fmtNum(s.anomaly_rate_pct, 2)}% of {fmtCompact(s.n_total)} · {s.method}</span>
                    </div>
                  </li>
                ))}
              </ul>
            ) : <Skeleton className="h-36" />}
          </Panel>

          <div className="flex flex-wrap justify-end gap-2">
            <button
              onClick={() => { setSelectedStation(affected?.id); navigate('flow') }}
              className="btn-secondary flex items-center gap-1.5 px-3 py-1.5 text-[11.5px] font-semibold"
            >
              <GitBranch size={12} /> Open station in Production
            </button>
            <button
              onClick={() => navigate('simulate')}
              className="btn-primary flex items-center gap-1.5 px-3 py-1.5 text-[11.5px] font-semibold"
            >
              <FlaskConical size={12} /> Continue to What-If Test <ArrowRight size={11} />
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
        ? `PROBLEM — ${inv.anomaly.metric} moved outside its expected range (${fmtNum(inv.anomaly.samples[0]?.expected_low, 1)}–${fmtNum(inv.anomaly.samples[0]?.expected_high, 1)}); readings near ${fmtNum(inv.anomaly.samples[0]?.observed, 1)}. ${fmtInt(inv.anomaly.n_anomalies)} unusual events, ${inv.anomaly.method} method.`
        : 'No dominant unusual pattern in the current scan.'
    case 'process':
      return `STATION — ${ap.name} carries the strongest multi-signal constraint: Constraint Risk ${fmtNum(ap.bottleneck_score, 0)}/100 (machine usage, waiting, queue and cycle signals; weights configurable in the backend).`
    case 'metrics':
      return `EVIDENCE — machine usage ${fmtPct(inv.evidence[0]?.value)}, waiting ${inv.evidence[1]?.value}, peak p95 ${inv.evidence[2]?.value}. Computed from named Detailed Factory Data fields.`
    case 'correlation':
      return matrix
        ? `SIGNALS — pairwise Pearson associations over ${fmtInt(matrix.n)} records. Strongest pairs: ${matrix.cells.filter((c) => c.i < c.j && Math.abs(c.r || 0) > 0.5).slice(0, 3).map((c) => `${c.a_short} ↔ ${c.b_short} (r=${c.r})`).join(', ') || 'none above |0.5|'}.`
        : 'Relationship matrix loading…'
    case 'cause':
      return `POSSIBLE CAUSE — material-flow accumulation at ${ap.name} is associated with downstream waiting. The data shows statistical association; causation requires validation against process records.`
    case 'impact':
      return `EFFECT — queue build-up and waiting reduce the effective production rate (${fmtInt(inv.evidence[4]?.value)} products/run mean). Quantified projections are on the What-If Test page, labelled PROJECTED.`
    case 'simulation':
      return 'WHAT-IF — the What-If Test projects production rate, waiting and machine-usage responses to cycle-time/capacity changes, using the Theory-of-Constraints-damped capacity model. All outputs are labelled PROJECTED.'
    default:
      return ''
  }
}

function CausalChain({ inv }) {
  const ap = inv.affected_process
  const chain = [
    { icon: <ArrowUp size={12} />, label: `Waiting builds up at ${ap.name}` },
    { icon: <ArrowDown size={12} />, label: 'Material flow slows upstream' },
    { icon: <ArrowDown size={12} />, label: 'Waiting time increases downstream' },
    { icon: <TrendingDown size={12} />, label: 'Production rate drops (observed association)' },
  ]
  return (
    <div>
      {chain.map((c, i) => (
        <div key={i}>
          <div className={`flex items-center gap-2.5 border-l-2 py-1.5 pl-3 text-[12px] ${
            i === chain.length - 1 ? 'border-red/60 bg-red/[0.03] text-red' : 'border-line2 text-mist'
          }`}>
            <span className={i === chain.length - 1 ? 'text-red' : 'text-fog'}>{c.icon}</span>
            {c.label}
          </div>
          {i < chain.length - 1 && <ArrowDown size={10} className="my-0.5 ml-5 text-line2" />}
        </div>
      ))}
      <p className="mt-2 text-[10.5px] leading-relaxed text-fog italic">
        Observed relationships across simulation runs — "strong association / possible
        contributor", requires validation. Not proven causation.
      </p>
    </div>
  )
}

function HeadFact({ label, value, sub }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] tracking-[0.07em] text-fog uppercase">{label}</dt>
      <dd className="truncate text-[13px] font-semibold text-ink">{value}</dd>
      {sub && <dd className="max-w-[240px] truncate text-[10px] text-fog/80" title={sub}>{sub}</dd>}
    </div>
  )
}

function Fact({ label, value }) {
  return (
    <div>
      <dt className="text-[10px] text-fog">{label}</dt>
      <dd className="tnum font-mono text-[12px] font-semibold text-ink">{value}</dd>
    </div>
  )
}
