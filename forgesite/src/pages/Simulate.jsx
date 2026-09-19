// Simulate — What-If Lab with PROJECTED labels and validated PREDICTED model.

import { useEffect, useState } from 'react'
import { FlaskConical, Play, RotateCcw, BrainCircuit, ArrowRight, Info } from 'lucide-react'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts'
import { api } from '../services/api'
import { useStore } from '../store'
import { Panel, Chip, Skeleton, chartTooltipStyle } from '../components/ui'
import { fmtInt, fmtNum, fmtPct, fmtSigned } from '../utils/format'

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
      logActivity('simulation', 'Simulation generated', `${station} · cycle ${fmtSigned(cycle, 0)}`)
      toast('success', `Projection ready — throughput ${fmtSigned(r.deltas.throughput_pct)}, queue ${fmtSigned(r.deltas.queue_pct)}`)
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
      logActivity('analysis', 'SKU prediction generated', `mean R² ${r.mean_r2_test}`)
    } catch (e) {
      toast('error', e.message)
    }
  }

  const compare = result
    ? [
        { name: 'Throughput', Baseline: result.baseline.throughput, Projected: result.projected.throughput },
        { name: 'Queue', Baseline: result.baseline.queue, Projected: result.projected.queue },
      ]
    : []

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-white tracking-tight flex items-center gap-2">
            <FlaskConical size={18} className="text-purple" /> What-If Lab
          </h2>
          <p className="text-xs text-fog">Change a parameter. See the projected consequence — clearly labelled, never presented as measured.</p>
        </div>
        <Chip label="SIMULATED / PROJECTED" tone="purple" />
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        {/* controls */}
        <Panel title="Scenario Controls" icon={<Play size={15} />}>
          <div className="space-y-4">
            <label className="block">
              <span className="text-[10px] uppercase tracking-wider text-fog">Station</span>
              <select
                value={station} onChange={(e) => setStation(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-line2 bg-navy-850 px-3 py-2 text-sm text-white outline-none focus:border-neon"
              >
                {(stations || []).map((s) => (
                  <option key={s.id} value={s.id}>{s.name} — {fmtNum(s.utilization, 0)}% util</option>
                ))}
              </select>
            </label>

            <Slider label="Cycle-time adjustment" value={cycle} onChange={setCycle}
              min={-20} max={20} step={5} format={(v) => fmtSigned(v, 0)}
              hint="Negative = faster cycles at the station" />
            <Slider label="Add capacity (%)" value={cap} onChange={setCap}
              min={0} max={100} step={10} format={(v) => `+${v}%`}
              hint="Fractional second resource" />
            <Slider label="Queue reduction (WIP policy)" value={queueRed} onChange={setQueueRed}
              min={0} max={50} step={10} format={(v) => `-${v}%`} />
            <Slider label="Demand adjustment" value={demand} onChange={setDemand}
              min={-20} max={20} step={5} format={(v) => fmtSigned(v, 0)} />

            <div className="flex gap-2 pt-1">
              <button
                onClick={run} disabled={running}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-neon to-purple py-2.5 text-xs font-semibold text-white glow-neon transition-transform hover:scale-[1.01] disabled:opacity-50"
              >
                <Play size={12} /> {running ? 'PROJECTING…' : 'RUN SIMULATION'}
              </button>
              <button onClick={() => { setCycle(-5); setCap(0); setQueueRed(0); setDemand(0); setResult(null); setImpact(null) }}
                className="rounded-lg border border-line2 px-3 text-fog hover:text-white" title="Reset">
                <RotateCcw size={13} />
              </button>
            </div>
          </div>
        </Panel>

        {/* results */}
        <div className="space-y-5 xl:col-span-2">
          {!result && !running && (
            <Panel title="Baseline (actual dataset values)" right={<Chip label="DERIVED" tone="cyan" />}>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Metric label="Throughput" value={fmtInt(54747)} sub="products/run mean" />
                <Metric label="Utilization" value={fmtNum(43.7, 1) + '%'} sub="station mean" />
                <Metric label="Queue" value={fmtNum(54.2, 1)} sub="units" />
                <Metric label="Waiting" value={fmtNum(1.4, 1) + ' min'} sub="Little's Law estimate" />
              </div>
              <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-line bg-navy-850/60 px-4 py-3 text-[11.5px] leading-relaxed text-fog">
                <Info size={13} className="mt-0.5 shrink-0 text-cyan" />
                Set the scenario controls and run the simulation. The engine uses the capacity model,
                M/M/1-shaped congestion and Little's Law — deterministic, dataset-derived, and always
                labelled PROJECTED.
              </div>
            </Panel>
          )}

          {result && (
            <Panel
              title="Baseline vs Projected" icon={<FlaskConical size={15} />}
              right={<Chip label="PROJECTED" tone="purple" />}
              glow
            >
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <DeltaMetric label="Throughput" before={fmtInt(result.baseline.throughput)}
                  after={fmtInt(result.projected.throughput)} delta={fmtSigned(result.deltas.throughput_pct)} good={result.deltas.throughput_pct >= 0} />
                <DeltaMetric label="Utilization" before={fmtPct(result.baseline.utilization)}
                  after={fmtPct(result.projected.utilization)} delta={fmtSigned(result.deltas.utilization_pp, 1, ' pp')} good={result.deltas.utilization_pp <= 0} />
                <DeltaMetric label="Queue" before={fmtNum(result.baseline.queue, 1)}
                  after={fmtNum(result.projected.queue, 1)} delta={fmtSigned(result.deltas.queue_pct)} good={result.deltas.queue_pct <= 0} />
                <DeltaMetric label="Waiting" before={fmtNum(result.baseline.wait_min, 1) + 'm'}
                  after={fmtNum(result.projected.wait_min, 1) + 'm'} delta={fmtSigned(result.deltas.wait_pct)} good={result.deltas.wait_pct <= 0} />
              </div>
              {compare.length > 0 && (
                <div className="mt-4 h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={compare} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid stroke="#1c2444" strokeDasharray="3 6" vertical={false} />
                      <XAxis dataKey="name" tick={{ fill: '#7d8bb0', fontSize: 10 }} stroke="#293357" />
                      <YAxis tick={{ fill: '#7d8bb0', fontSize: 9 }} stroke="#293357" />
                      <Tooltip contentStyle={chartTooltipStyle()} formatter={(v) => fmtInt(v)} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Bar dataKey="Baseline" fill="#3b4b7a" radius={[5, 5, 0, 0]} />
                      <Bar dataKey="Projected" fill="#8b5cf6" radius={[5, 5, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
              <details className="mt-3 rounded-lg border border-line bg-navy-850/60 px-4 py-2.5">
                <summary className="cursor-pointer text-[11px] font-medium text-mist">Method disclosure</summary>
                <p className="mt-2 text-[11px] leading-relaxed text-fog">{result.method}</p>
              </details>
            </Panel>
          )}

          {impact && (
            <Panel title="Operational Impact" right={<Chip label="DERIVED" tone="cyan" />}>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Metric label="Production" value={fmtSigned(impact.production_impact.throughput_delta, 0, '')} sub="units/run projected" tone="text-cyan" />
                <Metric label="Queue" value={fmtSigned(impact.queue_impact.delta, 1)} sub="units" tone={impact.queue_impact.delta <= 0 ? 'text-green' : 'text-red'} />
                <Metric label="Waiting" value={fmtSigned(impact.waiting_impact.delta_min, 1) + 'm'} sub="minutes" tone={impact.waiting_impact.delta_min <= 0 ? 'text-green' : 'text-red'} />
                <Metric label="Utilization" value={fmtSigned(impact.utilization_impact.delta_pp, 1) + ' pp'} sub="station load" />
              </div>
              <p className="mt-3 text-[10.5px] leading-relaxed text-fog">
                {impact.note} To add an economic layer, the backend accepts cost-per-unit and
                downtime-cost inputs — any resulting figures are labelled{' '}
                <span className="text-amber">USER-DEFINED ECONOMIC ESTIMATE</span>.
              </p>
            </Panel>
          )}

          {/* predictive model */}
          <Panel
            title="SKU Production Predictor" icon={<BrainCircuit size={15} />}
            right={modelStatus?.available
              ? <Chip label={`PREDICTED · R² ${modelStatus.mean_r2_test}`} tone="neon" />
              : <Chip label="DATA UNAVAILABLE" tone="fog" />}
          >
            {modelStatus?.available ? (
              <div className="grid gap-5 lg:grid-cols-2">
                <div className="space-y-3">
                  <p className="text-[11.5px] leading-relaxed text-fog">
                    Gradient-boosted model trained on the MAT workbook's Model 3 experiment set
                    ({fmtInt(modelStatus.n_samples)} events). Validation: {modelStatus.validation}.
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {[1, 2, 3, 4].map((i) => (
                      <label key={i} className="block">
                        <span className="text-[9.5px] uppercase tracking-wider text-fog">SKU{i} arrivals</span>
                        <input
                          type="number" value={predInputs[`sku${i}`]} min={0} step={100}
                          onChange={(e) => setPredInputs((p) => ({ ...p, [`sku${i}`]: Number(e.target.value) }))}
                          className="mt-1 w-full rounded-lg border border-line2 bg-navy-850 px-2.5 py-1.5 font-mono text-xs text-white outline-none focus:border-neon"
                        />
                      </label>
                    ))}
                  </div>
                  <button onClick={runPredict}
                    className="w-full rounded-lg border border-neon/40 bg-neon/10 py-2 text-xs font-semibold text-neon hover:bg-neon/20">
                    PREDICT CELL OUTPUT
                  </button>
                </div>
                <div>
                  {pred ? (
                    <div className="h-48">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={Object.entries(pred.predictions).map(([k, v]) => ({ cell: k, units: v }))}
                          margin={{ top: 6, right: 4, left: -16, bottom: 0 }}
                        >
                          <CartesianGrid stroke="#1c2444" strokeDasharray="3 6" vertical={false} />
                          <XAxis dataKey="cell" tick={{ fill: '#7d8bb0', fontSize: 8 }} stroke="#293357" interval={0} angle={-24} dy={8} />
                          <YAxis tick={{ fill: '#7d8bb0', fontSize: 9 }} stroke="#293357" />
                          <Tooltip contentStyle={chartTooltipStyle()} formatter={(v) => [fmtInt(v), 'PREDICTED units']} />
                          <Bar dataKey="units" fill="#4f7cff" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="grid h-48 place-items-center text-center text-[11px] text-fog">
                      Enter SKU arrival levels and predict cell/SKU production.
                    </div>
                  )}
                  {modelStatus.metrics && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-[10.5px] text-fog hover:text-mist">Validation metrics per target</summary>
                      <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                        {modelStatus.metrics.map((m) => (
                          <div key={m.target} className="flex justify-between rounded-md border border-line px-2 py-1 text-[10px]">
                            <span className="text-fog">{m.target}</span>
                            <span className="font-mono text-cyan">R² {m.r2_test}</span>
                          </div>
                        ))}
                      </div>
                    </details>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-xs text-fog">{modelStatus?.reason || 'Insufficient data for this analysis.'}</p>
            )}
          </Panel>

          {result && (
            <div className="flex justify-end">
              <button
                onClick={() => window.dispatchEvent(new CustomEvent('fs:goto-reports'))}
                className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-neon to-purple px-4 py-2 text-xs font-semibold text-white glow-neon"
              >
                CONTINUE TO REPORT <ArrowRight size={12} />
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
        <span className="text-[10px] uppercase tracking-wider text-fog">{label}</span>
        <span className="font-mono text-sm font-semibold text-cyan">{format(value)}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))} className="mt-1.5 w-full" aria-label={label} />
      {hint && <p className="text-[9.5px] text-fog/80">{hint}</p>}
    </div>
  )
}

function Metric({ label, value, sub, tone = 'text-white' }) {
  return (
    <div className="rounded-xl border border-line bg-navy-850/70 px-3.5 py-2.5">
      <p className="text-[9.5px] uppercase tracking-wider text-fog">{label}</p>
      <p className={`mt-0.5 font-mono text-xl font-semibold ${tone}`}>{value}</p>
      {sub && <p className="text-[9px] text-fog/80">{sub}</p>}
    </div>
  )
}

function DeltaMetric({ label, before, after, delta, good }) {
  return (
    <div className="rounded-xl border border-line bg-navy-850/70 px-3.5 py-2.5">
      <p className="text-[9.5px] uppercase tracking-wider text-fog">{label}</p>
      <div className="mt-1 flex items-baseline gap-1.5">
        <span className="font-mono text-[11px] text-fog line-through">{before}</span>
        <ArrowRight size={9} className="text-fog" />
        <span className={`font-mono text-lg font-bold ${good ? 'text-green' : 'text-red'}`}>{after}</span>
      </div>
      <p className={`mt-0.5 font-mono text-[11px] font-semibold ${good ? 'text-green' : 'text-red'}`}>{delta}</p>
    </div>
  )
}
