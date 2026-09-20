// What-If Test — try a process change and see the estimated result.
// All outputs are PROJECTED; the validated predictor keeps its real R².

import { useEffect, useState } from 'react'
import { Play, RotateCcw, BrainCircuit, ArrowRight, Info } from 'lucide-react'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts'
import { api } from '../services/api'
import { useStore } from '../store'
import { Panel, Chip, Skeleton, SectionTitle, CHART, chartTooltipStyle } from '../components/ui'
import { CircularProgress, LoadingLine, Term } from '../components/Feedback'
import { fmtInt, fmtCompact, fmtNum, fmtPct, fmtSigned } from '../utils/format'

export function Simulate() {
  const { selectedStation, stations, toast, logActivity } = useStore()
  const [station, setStation] = useState(selectedStation || 'PRESS3')
  const [cycle, setCycle] = useState(-5)
  const [cap, setCap] = useState(0)
  const [queueRed, setQueueRed] = useState(0)
  const [demand, setDemand] = useState(0)
  const [result, setResult] = useState(null)
  const [impact, setImpact] = useState(null)
  const [running, setRunning] = useState(false)
  const [modelStatus, setModelStatus] = useState(null)
  const [pred, setPred] = useState(null)
  const [predInputs, setPredInputs] = useState({ sku1: 14700, sku2: 14900, sku3: 14900, sku4: 14900 })

  useEffect(() => { api.modelStatus().then(setModelStatus).catch(() => setModelStatus({ available: false })) }, [])
  useEffect(() => { if (selectedStation) setStation(selectedStation) }, [selectedStation])

  // Demo mode triggers a real projection run.
  useEffect(() => {
    const h = () => { run() }
    window.addEventListener('fs:demo-run-simulation', h)
    return () => window.removeEventListener('fs:demo-run-simulation', h)
  })

  const run = async () => {
    setRunning(true)
    try {
      const r = await api.simulate({ station, cycle_adj_pct: cycle, capacity_add_pct: cap, queue_reduction_pct: queueRed, demand_adj_pct: demand })
      setResult(r)
      const imp = await api.impact({ station, cycle_adj_pct: cycle }).catch(() => null)
      setImpact(imp)
      logActivity('simulation', 'What-If Test generated', `${station} · cycle ${fmtSigned(cycle, 0)}`)
      toast('success', `Test result ready — production rate ${fmtSigned(r.deltas.throughput_pct)}, waiting ${fmtSigned(r.deltas.queue_pct)}`)
    } catch (e) {
      toast('error', e.message)
    } finally {
      setRunning(false)
    }
  }

  const runPredict = async () => {
    try {
      const r = await api.predict(predInputs)
      setPred(r)
      logActivity('analysis', 'Product Type prediction generated', `mean R² ${r.mean_r2_test}`)
    } catch (e) {
      toast('error', e.message)
    }
  }

  // Headline improvement: production-rate gain, shown once as a thin ring
  const tpGain = result ? Math.max(0, result.deltas.throughput_pct) : 0
  const gainStatus = tpGain >= 5 ? 'healthy' : tpGain >= 2 ? 'normal' : tpGain > 0 ? 'warning' : 'critical'

  const compare = result
    ? [
        { name: 'Production Rate', Baseline: result.baseline.throughput, 'After Change': result.projected.throughput },
        { name: 'Waiting', Baseline: result.baseline.queue, 'After Change': result.projected.queue },
      ]
    : []

  return (
    <div className="space-y-6">
      <SectionTitle
        title="What-If Test"
        note="Try a process change and see the estimated result — clearly labelled, never presented as measured"
        right={<Chip label="PROJECTED" tone="purple" />}
      />

      <div className="grid gap-4 xl:grid-cols-3">
        {/* controls */}
        <Panel title="Test Controls">
          <div className="space-y-4">
            <label className="block">
              <span className="text-[10px] font-semibold tracking-[0.07em] text-fog uppercase">Choose Station</span>
              <select
                value={station} onChange={(e) => setStation(e.target.value)}
                className="mt-1.5 w-full rounded-md border border-line2 bg-white px-2.5 py-1.5 text-[13px] text-ink outline-none focus:border-neon"
              >
                {(stations || []).map((s) => (
                  <option key={s.id} value={s.id}>{s.name} — {fmtNum(s.utilization, 0)}% machine usage</option>
                ))}
              </select>
            </label>

            <Slider label={<Term tech="Cycle time adjustment">Change Cycle Time</Term>} value={cycle} onChange={setCycle}
              min={-20} max={20} step={5} format={(v) => fmtSigned(v, 0)}
              hint="Negative = faster cycles at the station" />
            <Slider label="Add machine capacity" value={cap} onChange={setCap}
              min={0} max={100} step={10} format={(v) => `+${v}%`}
              hint="Fractional second machine" />
            <Slider label={<Term tech="Queue reduction (WIP policy)">Cut Waiting</Term>} value={queueRed} onChange={setQueueRed}
              min={0} max={50} step={10} format={(v) => `-${v}%`} />
            <Slider label="Change demand" value={demand} onChange={setDemand}
              min={-20} max={20} step={5} format={(v) => fmtSigned(v, 0)} />

            <div className="flex gap-2 pt-1">
              <button
                onClick={run} disabled={running}
                className="btn-primary flex flex-1 items-center justify-center gap-1.5 py-2 text-[11.5px] font-semibold"
              >
                <Play size={11} /> {running ? 'TESTING…' : 'RUN WHAT-IF TEST'}
              </button>
              <button onClick={() => { setCycle(-5); setCap(0); setQueueRed(0); setDemand(0); setResult(null); setImpact(null) }}
                className="btn-secondary px-3" title="Reset">
                <RotateCcw size={12} />
              </button>
            </div>
          </div>
        </Panel>

        {/* results */}
        <div className="space-y-4 xl:col-span-2">
          {running && (
            <div className="glass p-4">
              <LoadingLine label="Running What-If Test" />
              <Skeleton className="mt-4 h-36" />
            </div>
          )}

          {!result && !running && (
            <Panel title="Current Performance" right={<Chip label="DERIVED" tone="cyan" />}>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
                <Metric label="Production Rate" value={fmtCompact(54747)} sub="products/run mean" />
                <Metric label="Machine Usage" value={fmtNum(43.7, 1) + '%'} sub="station mean" />
                <Metric label="Waiting" value={fmtNum(54.2, 1)} sub="units" />
                <Metric label="Waiting minutes" value={fmtNum(1.4, 1)} sub="Little's Law estimate" />
              </dl>
              <div className="mt-4 flex items-start gap-2 border-t border-line pt-3 text-[11px] leading-relaxed text-fog">
                <Info size={12} className="mt-0.5 shrink-0 text-fog" />
                Set the controls and run the test. The engine uses the capacity model, waiting-time
                physics and Little's Law — deterministic, dataset-derived, always labelled PROJECTED.
              </div>
            </Panel>
          )}

          {result && !running && (
            <Panel title="Current vs After Change" right={<Chip label="PROJECTED" tone="purple" />}>
              <div className="flex flex-wrap items-center gap-5">
                <CircularProgress
                  value={Math.min(100, tpGain * 12)} label="Improvement"
                  subLabel={`Production rate ${fmtSigned(result.deltas.throughput_pct)}`}
                  status={gainStatus} size={84}
                />
                <dl className="grid flex-1 grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
                  <DeltaMetric label="Production Rate" before={fmtCompact(result.baseline.throughput)}
                    after={fmtCompact(result.projected.throughput)} delta={fmtSigned(result.deltas.throughput_pct)} good={result.deltas.throughput_pct >= 0} />
                  <DeltaMetric label="Machine Usage" before={fmtPct(result.baseline.utilization)}
                    after={fmtPct(result.projected.utilization)} delta={fmtSigned(result.deltas.utilization_pp, 1, ' pp')} good={result.deltas.utilization_pp <= 0} />
                  <DeltaMetric label="Waiting" before={fmtNum(result.baseline.queue, 1)}
                    after={fmtNum(result.projected.queue, 1)} delta={fmtSigned(result.deltas.queue_pct)} good={result.deltas.queue_pct <= 0} />
                  <DeltaMetric label="Waiting minutes" before={fmtNum(result.baseline.wait_min, 1)}
                    after={fmtNum(result.projected.wait_min, 1)} delta={fmtSigned(result.deltas.wait_pct)} good={result.deltas.wait_pct <= 0} />
                </dl>
              </div>
              {compare.length > 0 && (
                <div className="mt-4" style={{ height: 190 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={compare} margin={{ top: 6, right: 4, left: -8, bottom: 0 }}>
                      <CartesianGrid stroke={CHART.grid} strokeDasharray="2 4" vertical={false} />
                      <XAxis dataKey="name" tick={{ fill: '#5F6670', fontSize: 10 }} stroke={CHART.axis} />
                      <YAxis tick={CHART.tick} stroke={CHART.axis} width={44} tickFormatter={(v) => fmtCompact(v, '')} />
                      <Tooltip contentStyle={chartTooltipStyle()} formatter={(v) => fmtInt(v)} />
                      <Legend wrapperStyle={{ fontSize: 11 }} iconSize={8} />
                      <Bar dataKey="Baseline" fill={CHART.series.gray} radius={[3, 3, 0, 0]} />
                      <Bar dataKey="After Change" fill={CHART.series.purple} radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
              <details className="mt-3 border-t border-line pt-2.5">
                <summary className="cursor-pointer text-[11px] font-medium text-mist">How this is calculated</summary>
                <p className="mt-1.5 text-[11px] leading-relaxed text-fog">{result.method}</p>
              </details>
            </Panel>
          )}

          {impact && !running && (
            <Panel title="What It Affects" right={<Chip label="DERIVED" tone="cyan" />}>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
                <Metric label="Production" value={fmtSigned(impact.production_impact.throughput_delta, 0, '')} sub="units/run projected" />
                <Metric label="Waiting" value={fmtSigned(impact.queue_impact.delta, 1)} sub="units" tone={impact.queue_impact.delta <= 0 ? 'text-green' : 'text-red'} />
                <Metric label="Waiting minutes" value={fmtSigned(impact.waiting_impact.delta_min, 1)} sub="minutes" tone={impact.waiting_impact.delta_min <= 0 ? 'text-green' : 'text-red'} />
                <Metric label="Machine Usage" value={fmtSigned(impact.utilization_impact.delta_pp, 1) + ' pp'} sub="station load" />
              </dl>
              <p className="mt-3 border-t border-line pt-2.5 text-[10.5px] leading-relaxed text-fog">
                {impact.note} To add a money estimate, the backend accepts cost-per-unit and
                downtime-cost inputs — any resulting figures are labelled{' '}
                <span className="font-semibold text-amber">USER-DEFINED ECONOMIC ESTIMATE</span>.
              </p>
            </Panel>
          )}

          {/* predictive model */}
          <Panel
            title="Product Type Predictor" icon={<BrainCircuit size={13} />}
            right={modelStatus?.available
              ? <Chip label={`PREDICTED · R² ${modelStatus.mean_r2_test}`} tone="neon" />
              : <Chip label="DATA UNAVAILABLE" tone="fog" />}
          >
            {modelStatus?.available ? (
              <div className="grid gap-5 lg:grid-cols-2">
                <div className="space-y-3">
                  <p className="text-[11px] leading-relaxed text-fog">
                    Model trained on the experiment workbook's Detailed Factory Data set
                    ({fmtInt(modelStatus.n_samples)} events). Validation: {modelStatus.validation}.
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {[1, 2, 3, 4].map((i) => (
                      <label key={i} className="block">
                        <span className="text-[9.5px] font-semibold tracking-[0.07em] text-fog uppercase">Product Type {i} arrivals</span>
                        <input
                          type="number" value={predInputs[`sku${i}`]} min={0} step={100}
                          onChange={(e) => setPredInputs((p) => ({ ...p, [`sku${i}`]: Number(e.target.value) }))}
                          className="tnum mt-1 w-full rounded-md border border-line2 bg-white px-2.5 py-1.5 font-mono text-[12px] text-ink outline-none focus:border-neon"
                        />
                      </label>
                    ))}
                  </div>
                  <button onClick={runPredict}
                    className="btn-secondary w-full py-2 text-[11.5px] font-semibold text-neon">
                    PREDICT CELL OUTPUT
                  </button>
                </div>
                <div>
                  {pred ? (
                    <div style={{ height: 190 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={Object.entries(pred.predictions).map(([k, v]) => ({ cell: k, units: v }))}
                          margin={{ top: 6, right: 4, left: -12, bottom: 0 }}
                        >
                          <CartesianGrid stroke={CHART.grid} strokeDasharray="2 4" vertical={false} />
                          <XAxis dataKey="cell" tick={CHART.tick} stroke={CHART.axis} interval={0} angle={-24} dy={8} />
                          <YAxis tick={CHART.tick} stroke={CHART.axis} width={40} tickFormatter={(v) => fmtCompact(v, '')} />
                          <Tooltip contentStyle={chartTooltipStyle()} formatter={(v) => [fmtInt(v), 'PREDICTED units']} />
                          <Bar dataKey="units" fill={CHART.series.blue} radius={[3, 3, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="grid h-44 place-items-center text-center text-[11px] text-fog">
                      Enter Product Type arrival levels and predict cell output.
                    </div>
                  )}
                  {modelStatus.metrics && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-[10.5px] text-fog hover:text-mist">Validation metrics per target</summary>
                      <div className="mt-1.5 grid grid-cols-2 gap-1">
                        {modelStatus.metrics.map((m) => (
                          <div key={m.target} className="flex justify-between border-b border-line px-1 py-1 text-[10px]">
                            <span className="text-fog">{m.target}</span>
                            <span className="tnum font-mono text-cyan">R² {m.r2_test}</span>
                          </div>
                        ))}
                      </div>
                    </details>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-[12px] text-fog">{modelStatus?.reason || 'Insufficient data for this analysis.'}</p>
            )}
          </Panel>

          {result && !running && (
            <div className="flex justify-end">
              <button
                onClick={() => window.dispatchEvent(new CustomEvent('fs:goto-reports'))}
                className="btn-primary flex items-center gap-1.5 px-3 py-1.5 text-[11.5px] font-semibold"
              >
                CONTINUE TO AI SUMMARY <ArrowRight size={11} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Slider({ label, value, onChange, min, max, step, format, hint }) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold tracking-[0.07em] text-fog uppercase">{label}</span>
        <span className="tnum font-mono text-[13px] font-semibold text-neon">{format(value)}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))} className="mt-1.5 w-full" aria-label={typeof label === 'string' ? label : 'control'} />
      {hint && <p className="text-[10px] text-fog/80">{hint}</p>}
    </div>
  )
}

function Metric({ label, value, sub, tone = 'text-ink' }) {
  return (
    <div>
      <dt className="text-[9.5px] font-semibold tracking-[0.07em] text-fog uppercase">{label}</dt>
      <dd className={`tnum mt-0.5 font-mono text-[17px] font-semibold ${tone}`}>{value}</dd>
      {sub && <dd className="text-[10px] text-fog/80">{sub}</dd>}
    </div>
  )
}

function DeltaMetric({ label, before, after, delta, good }) {
  return (
    <div>
      <dt className="text-[9.5px] font-semibold tracking-[0.07em] text-fog uppercase">{label}</dt>
      <dd className="mt-0.5 flex items-baseline gap-1">
        <span className="tnum font-mono text-[11px] text-fog line-through">{before}</span>
        <ArrowRight size={9} className="shrink-0 text-fog" />
        <span className={`tnum font-mono text-[16px] font-semibold ${good ? 'text-green' : 'text-red'}`}>{after}</span>
      </dd>
      <dd className={`tnum font-mono text-[11px] font-semibold ${good ? 'text-green' : 'text-red'}`}>{delta}</dd>
    </div>
  )
}
