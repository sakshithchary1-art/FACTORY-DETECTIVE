// PAGE 6 — WHAT-IF SIMULATOR: change the process, see the consequence.

import { useCallback, useEffect, useState } from 'react'
import { ArrowRight, FlaskConical, Info, Play, RotateCcw } from 'lucide-react'
import {
  Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { api } from '../api'
import { Badge, Button, MetricCard, Panel, SkeletonBlock } from '../components/ui'
import { fmtInt, fmtMoney, fmtNum, fmtPct, fmtSigned } from '../lib/ui'
import { DEMO_CASE_ID, useStore } from '../store'
import type { Station } from '../types'

export function Simulator() {
  const { inspection, simulation, setSimulation, simRan, setSimRan, costs, setCosts, navigate, toast, demoActive } = useStore()
  const [stations, setStations] = useState<Station[]>([])
  const [station, setStation] = useState(inspection.station || 'PRESS3')
  const [cycle, setCycle] = useState(-10)
  const [cap, setCap] = useState(false)
  const [queueRed, setQueueRed] = useState(0)
  const [running, setRunning] = useState(false)

  useEffect(() => {
    api.stations().then((s) => setStations(s.stations)).catch(() => null)
  }, [])

  const run = useCallback(async (opts?: { silent?: boolean }) => {
    setRunning(true)
    try {
      const sim = await api.simulate({
        station, cycle_adj_pct: cycle, extra_capacity: cap,
        queue_reduction_pct: queueRed, case_id: DEMO_CASE_ID,
      })
      setSimulation(sim)
      setSimRan(true)
      const units = sim.simulated.throughput - sim.current.throughput
      const c = await api.costs({
        scrap_unit_cost: 1800, rework_unit_cost: 420,
        downtime_hour_cost: 15000, contribution_margin: 2600,
        units_delta: units, case_id: DEMO_CASE_ID,
      }).catch(() => null)
      if (c) setCosts(c)
      if (!opts?.silent) {
        toast('success', `Simulation complete — throughput ${fmtSigned(sim.deltas.throughput_pct)}, queue ${fmtSigned(sim.deltas.queue_pct)}.`)
      }
    } catch (e) {
      toast('error', e instanceof Error ? e.message : 'Simulation failed')
    } finally {
      setRunning(false)
    }
  }, [station, cycle, cap, queueRed, setSimulation, setSimRan, setCosts, toast])

  // demo orchestration hook
  useEffect(() => {
    const handler = (e: Event) => {
      const d = (e as CustomEvent).detail as { cycle_adj_pct?: number } | undefined
      if (d?.cycle_adj_pct !== undefined) setCycle(d.cycle_adj_pct)
      void run({ silent: true })
    }
    window.addEventListener('fd:demo-simulate', handler)
    return () => window.removeEventListener('fd:demo-simulate', handler)
  }, [run])

  const stName = stations.find((s) => s.id === station)?.name ?? station
  const cur = simulation?.current
  const sim = simulation?.simulated
  const d = simulation?.deltas

  const compare = cur && sim
    ? [
        { name: 'Throughput', current: cur.throughput, simulated: sim.throughput },
        { name: 'Queue', current: cur.queue, simulated: sim.queue },
      ]
    : []

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-mono text-xl font-bold tracking-[0.2em] text-white">WHAT-IF SIMULATOR</h1>
          <p className="mt-1 text-sm text-fog">“Change the process. See the consequence.”</p>
        </div>
        <Badge tone="violet">PROTOTYPE SIMULATION</Badge>
      </header>

      <div className="grid gap-5 xl:grid-cols-3">
        {/* controls */}
        <Panel title="SCENARIO CONTROLS" tag="PROTOTYPE SIMULATION" className="xl:col-span-1">
          <div className="space-y-4">
            <label className="block">
              <span className="font-mono text-[10px] tracking-[0.14em] text-fog">STATION</span>
              <select
                value={station}
                onChange={(e) => setStation(e.target.value)}
                className="mt-1 w-full rounded-md border border-line2 bg-ink px-3 py-2 font-mono text-sm text-white outline-none focus:border-cyan-dim"
              >
                {stations.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} — {s.utilization != null ? `${fmtNum(s.utilization, 0)}% util` : '—'}
                  </option>
                ))}
              </select>
            </label>

            <div>
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] tracking-[0.14em] text-fog">
                  CYCLE TIME ADJUSTMENT
                </span>
                <span className={`font-mono text-sm font-bold tabular-nums ${cycle < 0 ? 'text-emerald-400' : cycle > 0 ? 'text-red-400' : 'text-white'}`}>
                  {fmtSigned(cycle, 0)}
                </span>
              </div>
              <input
                type="range" min={-20} max={20} step={5} value={cycle}
                onChange={(e) => setCycle(Number(e.target.value))}
                className="mt-2 w-full"
                aria-label="Cycle time adjustment percent"
              />
              <div className="flex justify-between font-mono text-[9px] text-fog">
                <span>-20% FASTER</span><span>CURRENT</span><span>+20% SLOWER</span>
              </div>
            </div>

            <label className="flex items-center justify-between rounded-md border border-line bg-ink/50 px-3 py-2.5">
              <span>
                <span className="text-xs font-semibold text-mist">Add parallel capacity</span>
                <span className="block text-[10px] text-fog">Second resource at the station</span>
              </span>
              <input
                type="checkbox" checked={cap} onChange={(e) => setCap(e.target.checked)}
                className="h-4 w-4 accent-cyan-400"
              />
            </label>

            <div>
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] tracking-[0.14em] text-fog">QUEUE REDUCTION (WIP POLICY)</span>
                <span className="font-mono text-sm font-bold tabular-nums text-cyan-300">-{queueRed}%</span>
              </div>
              <input
                type="range" min={0} max={50} step={10} value={queueRed}
                onChange={(e) => setQueueRed(Number(e.target.value))}
                className="mt-2 w-full"
                aria-label="Queue reduction percent"
              />
            </div>

            <div className="flex gap-2">
              <Button variant="primary" className="flex-1" onClick={() => void run()} disabled={running}>
                <Play size={12} className="fill-cyan-200" /> {running ? 'RUNNING…' : 'RUN SIMULATION'}
              </Button>
              <Button
                variant="ghost" title="Reset controls"
                onClick={() => { setCycle(-10); setCap(false); setQueueRed(0) }}
              >
                <RotateCcw size={12} />
              </Button>
            </div>
            {demoActive && (
              <p className="text-[10px] text-cyan-300/80">Demo mode will trigger the run automatically.</p>
            )}
          </div>
        </Panel>

        {/* comparison */}
        <div className="space-y-5 xl:col-span-2">
          {!simRan && !running && (
            <Panel title="CURRENT STATE" subtitle={`${stName} · baseline from Model 3 means`} tag="REAL DATA">
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <MetricCard label="THROUGHPUT" value={fmtInt(cur?.throughput ?? 54747)} unit="products/run" loading={false} />
                <MetricCard label="UTILIZATION" value={fmtPct(cur?.utilization ?? 43.7)} loading={false}
                  level={utilLevelSafe(cur?.utilization)} />
                <MetricCard label="QUEUE" value={fmtNum(cur?.queue ?? 54.2, 1)} unit="units" loading={false} />
                <MetricCard label="WAIT TIME" value={fmtNum((cur?.wait_time ?? 0.02) * 60, 1)} unit="min" loading={false} />
              </div>
              <div className="mt-4 flex items-center gap-2 rounded-sm border border-line bg-ink/50 px-3 py-2.5 text-[11px] text-fog">
                <FlaskConical size={13} className="shrink-0 text-cyan-300" />
                Adjust the scenario controls and press RUN SIMULATION — the simulated state and
                business impact will appear here.
              </div>
            </Panel>
          )}

          {(running || (simRan && simulation)) && (
            <Panel
              title="CURRENT VS SIMULATED"
              subtitle={simulation ? `${simulation.station.name} · ${simulation.label}` : undefined}
              tag="PROTOTYPE SIMULATION"
              right={d && (
                <span className="font-mono text-[11px] text-fog">
                  elasticity {fmtNum(simulation?.elasticity_used, 1)} units/pp
                </span>
              )}
            >
              {running && !simulation ? (
                <SkeletonBlock className="h-44" />
              ) : simulation ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                    <DeltaCard label="THROUGHPUT" before={fmtInt(simulation.current.throughput)}
                      after={fmtInt(simulation.simulated.throughput)} delta={fmtSigned(simulation.deltas.throughput_pct)}
                      good={simulation.deltas.throughput_pct >= 0} />
                    <DeltaCard label="UTILIZATION" before={fmtPct(simulation.current.utilization)}
                      after={fmtPct(simulation.simulated.utilization)}
                      delta={fmtSigned(simulation.deltas.utilization_pct, 1, ' pp')}
                      good={simulation.deltas.utilization_pct <= 0} />
                    <DeltaCard label="QUEUE" before={fmtNum(simulation.current.queue, 1)}
                      after={fmtNum(simulation.simulated.queue, 1)}
                      delta={fmtSigned(simulation.deltas.queue_pct)}
                      good={simulation.deltas.queue_pct <= 0} />
                    <DeltaCard label="WAIT TIME" before={fmtNum(simulation.current.wait_time * 60, 1) + ' min'}
                      after={fmtNum(simulation.simulated.wait_time * 60, 1) + ' min'}
                      delta={fmtSigned(simulation.deltas.wait_time_pct)}
                      good={simulation.deltas.wait_time_pct <= 0} />
                  </div>

                  {compare.length > 0 && (
                    <div className="h-52">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={compare} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
                          <CartesianGrid stroke="#1e2937" strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="name" tick={{ fill: '#8b98ab', fontSize: 10, fontFamily: 'monospace' }} stroke="#2a3849" />
                          <YAxis tick={{ fill: '#8b98ab', fontSize: 10 }} stroke="#2a3849" />
                          <Tooltip
                            contentStyle={{ background: '#0e141d', border: '1px solid #2a3849', borderRadius: 4, fontSize: 11 }}
                            formatter={(v) => (typeof v === 'number' ? v.toLocaleString('en-US') : v)}
                            cursor={{ fill: 'rgba(34,211,238,0.06)' }}
                          />
                          <Legend wrapperStyle={{ fontSize: 10, fontFamily: 'monospace' }} />
                          <Bar dataKey="current" name="Current" fill="#3b4b61" radius={[3, 3, 0, 0]} />
                          <Bar dataKey="simulated" name="Simulated" fill="#22d3ee" radius={[3, 3, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>
              ) : null}
            </Panel>
          )}

          {simRan && simulation && (
            <Panel title="BUSINESS IMPACT" tag="PROTOTYPE SIMULATION"
              right={costs && <span className="font-mono text-sm font-bold text-cyan-300">{fmtMoney(costs.total_estimated_impact)}</span>}>
              <div className="grid gap-3 md:grid-cols-3">
                <MetricCard
                  label="ESTIMATED ADDITIONAL OUTPUT"
                  value={fmtSigned(simulation.simulated.throughput - simulation.current.throughput, 0, '')}
                  unit="units/run" loading={false}
                  sub={(simulation.simulated.throughput - simulation.current.throughput) >= 0 ? 'gained per run' : 'lost per run'}
                />
                <MetricCard
                  label="RECOVERED MARGIN ESTIMATE"
                  value={costs ? fmtMoney(costs.breakdown.recovered_margin_if_improved) : '—'}
                  sub="at ₹2,600/unit contribution (assumption)" loading={!costs}
                />
                <MetricCard
                  label="CURRENT IMPACT BASELINE"
                  value={costs ? fmtMoney(costs.total_estimated_impact) : '—'}
                  sub="from the Impact page assumptions" loading={!costs}
                />
              </div>
              <p className="mt-3 rounded-sm border border-violet-500/25 bg-violet-500/5 px-3 py-2 text-[11px] leading-relaxed text-violet-200/90">
                {simulation.note} Estimates are derived from dataset relationships and configurable
                assumptions — not the original Arena model.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button variant="primary" onClick={() => navigate('brief')}>
                  GENERATE AI DECISION BRIEF <ArrowRight size={12} />
                </Button>
                <Button onClick={() => navigate('impact')}>REVIEW COST ASSUMPTIONS</Button>
              </div>
            </Panel>
          )}

          <Panel title="HOW THE SIMULATION WORKS" tag="PROTOTYPE SIMULATION">
            <p className="flex items-start gap-2 text-[11.5px] leading-relaxed text-fog">
              <Info size={13} className="mt-0.5 shrink-0 text-cyan-300" />
              {simulation?.method ??
                'Deterministic analytical model — capacity response to cycle-time changes, M/M/1-shaped congestion, Little\'s Law waiting. Run a simulation to see its exact parameters.'}
            </p>
            <p className="mt-2 text-[11px] text-fog">
              Deterministic: identical inputs always produce identical outputs. No randomness,
              no invented metrics.
            </p>
          </Panel>
        </div>
      </div>
    </div>
  )
}

function DeltaCard({ label, before, after, delta, good }: {
  label: string; before: string; after: string; delta: string; good: boolean
}) {
  return (
    <div className="rounded-md border border-line bg-ink/50 p-3">
      <p className="font-mono text-[9px] tracking-[0.16em] text-fog">{label}</p>
      <div className="mt-1.5 flex items-baseline gap-1.5">
        <span className="font-mono text-sm text-fog line-through decoration-fog/40">{before}</span>
        <ArrowRight size={10} className="text-fog" />
        <span className="font-mono text-lg font-bold tabular-nums text-white">{after}</span>
      </div>
      <p className={`mt-1 font-mono text-xs font-semibold tabular-nums ${good ? 'text-emerald-400' : 'text-red-400'}`}>
        {delta}
      </p>
    </div>
  )
}

function utilLevelSafe(v: number | undefined) {
  if (v == null) return undefined
  if (v > 95) return 'critical' as const
  if (v > 85) return 'high' as const
  if (v >= 70) return 'watch' as const
  return 'healthy' as const
}
