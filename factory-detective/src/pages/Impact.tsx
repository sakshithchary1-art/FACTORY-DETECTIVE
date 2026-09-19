// PAGE 5 — IMPACT: transparent cost model with configurable assumptions.

import { useEffect, useState } from 'react'
import {
  AlertTriangle, ArrowRight, ChevronDown, Clock, PackageX, RotateCcw,
  SlidersHorizontal, TrendingDown, Wrench,
} from 'lucide-react'
import type { ReactNode } from 'react'
import {
  Bar, BarChart, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { api } from '../api'
import { Button, MetricCard, Panel, SkeletonBlock } from '../components/ui'
import { fmtMoney, fmtMoneyShort, fmtNum } from '../lib/ui'
import { DEMO_CASE_ID, useStore } from '../store'
import type { CostImpact, Investigation } from '../types'

export function Impact() {
  const { costs, setCosts, navigate } = useStore()
  const [inv, setInv] = useState<Investigation | null>(null)
  const [assumptions, setAssumptions] = useState({
    scrap_unit_cost: 1800,
    rework_unit_cost: 420,
    downtime_hour_cost: 15000,
    contribution_margin: 2600,
  })
  const [quantities, setQuantities] = useState({
    scrap_units: 14, rework_units: 31, downtime_hours: 6.5,
  })
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [calculating, setCalculating] = useState(false)

  useEffect(() => {
    api.investigation(DEMO_CASE_ID).then(setInv).catch(() => null)
  }, [])

  useEffect(() => {
    setCalculating(true)
    const t = setTimeout(() => {
      api
        .costs({
          ...assumptions,
          units_delta: 0,
          case_id: DEMO_CASE_ID,
        })
        .then((c) => {
          // fold in user-edited quantities (backend defaults match)
          const scaled: CostImpact = {
            ...c,
            quantities: {
              ...c.quantities,
              scrap_units: quantities.scrap_units,
              rework_units: quantities.rework_units,
              downtime_hours: quantities.downtime_hours,
            },
            breakdown: {
              ...c.breakdown,
              scrap: quantities.scrap_units * assumptions.scrap_unit_cost,
              rework: quantities.rework_units * assumptions.rework_unit_cost,
              downtime: quantities.downtime_hours * assumptions.downtime_hour_cost,
            },
          }
          const total =
            scaled.breakdown.scrap + scaled.breakdown.rework +
            scaled.breakdown.downtime + scaled.breakdown.lost_output
          const final = { ...scaled, total_estimated_impact: total }
          setCosts(final)
          setCalculating(false)
        })
        .catch(() => setCalculating(false))
    }, 120)
    return () => clearTimeout(t)
  }, [assumptions, quantities, setCosts])

  const b = costs?.breakdown
  const waterfall = b
    ? [
        { name: 'SCRAP', value: b.scrap, fill: '#ef4444' },
        { name: 'REWORK', value: b.rework, fill: '#f59e0b' },
        { name: 'DOWNTIME', value: b.downtime, fill: '#fbbf24' },
        { name: 'LOST OUTPUT', value: b.lost_output, fill: '#8b5cf6' },
        { name: 'TOTAL', value: costs!.total_estimated_impact, fill: '#22d3ee' },
      ]
    : []

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-mono text-xl font-bold tracking-[0.2em] text-white">COST IMPACT</h1>
          <p className="mt-1 text-sm text-fog">
            From process signals to business numbers — every ₹ here comes from
            <span className="text-amber-300"> user-configured assumptions</span>.
          </p>
        </div>
        <Button onClick={() => setDrawerOpen((v) => !v)}>
          <SlidersHorizontal size={12} /> ASSUMPTIONS {drawerOpen ? '▲' : '▼'}
        </Button>
      </header>

      {drawerOpen && (
        <Panel title="ASSUMPTIONS — USER-CONFIGURED" tag="USER ASSUMPTIONS">
          <p className="mb-4 text-[11px] leading-relaxed text-fog">
            The dataset does not define monetary costs. These are planning assumptions you
            control; formulas: Scrap = units × cost/unit · Rework = units × cost/unit ·
            Downtime = hours × cost/hour · Lost output = units × contribution margin.
          </p>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <NumField
              label="Cost per scrapped unit (₹)" value={assumptions.scrap_unit_cost}
              onChange={(v) => setAssumptions((a) => ({ ...a, scrap_unit_cost: v }))}
              hint="Material + labour lost per scrapped unit"
            />
            <NumField
              label="Cost per reworked unit (₹)" value={assumptions.rework_unit_cost}
              onChange={(v) => setAssumptions((a) => ({ ...a, rework_unit_cost: v }))}
              hint="Additional processing per reworked unit"
            />
            <NumField
              label="Cost per downtime hour (₹)" value={assumptions.downtime_hour_cost}
              onChange={(v) => setAssumptions((a) => ({ ...a, downtime_hour_cost: v }))}
              hint="Lost contribution + fixed cost per hour"
            />
            <NumField
              label="Contribution margin per unit (₹)" value={assumptions.contribution_margin}
              onChange={(v) => setAssumptions((a) => ({ ...a, contribution_margin: v }))}
              hint="Margin per unit of unfilled demand"
            />
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <NumField
              label="Scrapped units (case FD-017)" value={quantities.scrap_units} step={1}
              onChange={(v) => setQuantities((q) => ({ ...q, scrap_units: v }))}
              hint="Units rejected after inspection finding"
            />
            <NumField
              label="Reworked units" value={quantities.rework_units} step={1}
              onChange={(v) => setQuantities((q) => ({ ...q, rework_units: v }))}
              hint="Units routed through rework"
            />
            <NumField
              label="Downtime hours" value={quantities.downtime_hours} step={0.5}
              onChange={(v) => setQuantities((q) => ({ ...q, downtime_hours: v }))}
              hint="Station stoppage associated with the investigation window"
            />
          </div>
        </Panel>
      )}

      {/* four loss cards */}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <LossCard
          icon={<PackageX size={16} />} label="SCRAP"
          value={b ? fmtMoney(b.scrap) : '—'}
          sub={costs ? `${costs.quantities.scrap_units} units × ${fmtMoney(assumptions.scrap_unit_cost)}` : ''}
          tone="text-red-400" loading={!costs}
        />
        <LossCard
          icon={<Wrench size={16} />} label="REWORK"
          value={b ? fmtMoney(b.rework) : '—'}
          sub={costs ? `${costs.quantities.rework_units} units × ${fmtMoney(assumptions.rework_unit_cost)}` : ''}
          tone="text-amber-400" loading={!costs}
        />
        <LossCard
          icon={<Clock size={16} />} label="DOWNTIME"
          value={b ? fmtMoney(b.downtime) : '—'}
          sub={costs ? `${costs.quantities.downtime_hours} h × ${fmtMoney(assumptions.downtime_hour_cost)}` : ''}
          tone="text-amber-300" loading={!costs}
        />
        <LossCard
          icon={<TrendingDown size={16} />} label="LOST OUTPUT"
          value={b ? fmtMoney(b.lost_output) : '—'}
          sub={costs ? `${fmtNum(costs.quantities.lost_units, 0)} units × ${fmtMoney(assumptions.contribution_margin)}` : ''}
          tone="text-violet-300" loading={!costs}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-5">
        <Panel
          title="ESTIMATED COST IMPACT — WATERFALL"
          tag="USER ASSUMPTIONS"
          className="xl:col-span-3"
          right={
            costs && (
              <span className="font-mono text-sm font-bold text-cyan-300">
                {fmtMoney(costs.total_estimated_impact)}
              </span>
            )
          }
        >
          {costs && !calculating ? (
            <>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={waterfall} margin={{ top: 22, right: 8, bottom: 4, left: 18 }}>
                    <XAxis dataKey="name" tick={{ fill: '#8b98ab', fontSize: 10, fontFamily: 'monospace' }} stroke="#2a3849" />
                    <YAxis
                      tick={{ fill: '#8b98ab', fontSize: 10 }} stroke="#2a3849" width={64}
                      tickFormatter={(v) => fmtMoneyShort(v as number).replace('₹', '')}
                    />
                    <Tooltip
                      contentStyle={{ background: '#0e141d', border: '1px solid #2a3849', borderRadius: 4, fontSize: 11 }}
                      formatter={(v) => [fmtMoney(v as number), 'Estimated impact']}
                      cursor={{ fill: 'rgba(34,211,238,0.06)' }}
                    />
                    <Bar dataKey="value" radius={[3, 3, 0, 0]}>
                      {waterfall.map((e) => (
                        <Cell key={e.name} fill={e.fill} fillOpacity={0.82} />
                      ))}
                      <LabelList
                        dataKey="value"
                        position="top"
                        formatter={(v: unknown) => fmtMoneyShort(Number(v ?? 0))}
                        style={{ fill: '#b9c4d4', fontSize: 10, fontFamily: 'monospace' }}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p className="mt-2 text-center text-[11px] text-fog">
                Total estimated impact = scrap + rework + downtime + lost output ·{' '}
                <span className="text-amber-300">user-configured assumptions, not audited costs</span>
              </p>
            </>
          ) : (
            <SkeletonBlock className="h-64" />
          )}
        </Panel>

        <div className="space-y-5 xl:col-span-2">
          <Panel title="CURRENT ESTIMATE" tag="USER ASSUMPTIONS">
            <MetricCard
              label="TOTAL ESTIMATED IMPACT"
              value={costs ? fmtMoney(costs.total_estimated_impact) : '—'}
              sub="scenario quantity basis · case FD-017"
              loading={!costs}
            />
            {costs && (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <MiniFact label="Lost units (current)" value={fmtNum(costs.quantities.lost_units, 0)} />
                <MiniFact label="Recovered margin if improved" value={fmtMoneyShort(costs.breakdown.recovered_margin_if_improved)} />
              </div>
            )}
            <p className="mt-3 text-[11px] leading-relaxed text-fog">
              Run the What-If Simulator to see how a process change moves the recovered-margin
              figure against these assumptions.
            </p>
          </Panel>

          <Panel title="WHY THIS IS TRANSPARENT" tag="USER ASSUMPTIONS">
            <ul className="space-y-2 text-[11.5px] leading-relaxed text-fog">
              <li className="flex gap-2"><AlertTriangle size={13} className="mt-0.5 shrink-0 text-amber-400" />
                The supplied dataset contains operational measures only — no cost ledger. Monetary
                figures are planning assumptions.</li>
              <li className="flex gap-2"><RotateCcw size={13} className="mt-0.5 shrink-0 text-cyan-300" />
                Every assumption is editable above and immediately reflected in the waterfall.</li>
              <li className="flex gap-2"><ArrowRight size={13} className="mt-0.5 shrink-0 text-cyan-300" />
                Case quantities (14 scrap / 31 rework / 6.5 h downtime) are demo quantities tied to
                the FD-017 narrative — adjust them for your own scenario.</li>
            </ul>
          </Panel>

          {inv && (
            <Panel title="CASE CONTEXT" tag="DEMO DATA">
              <p className="text-xs leading-relaxed text-mist">
                {inv.defect} · batch {inv.batch} · traced to {inv.station_name}.
                {inv.metrics.queue_mean != null && (
                  <> Queue ahead of the station averages {fmtNum(inv.metrics.queue_mean, 1)} units —
                  the waiting time that drives downtime and lost output in this scenario.</>
                )}
              </p>
              <Button className="mt-3" variant="primary" onClick={() => navigate('simulator')}>
                OPEN WHAT-IF SIMULATOR
              </Button>
            </Panel>
          )}
        </div>
      </div>

      <ChevronDown className="hidden" />
    </div>
  )
}

function LossCard({ icon, label, value, sub, tone, loading }: {
  icon: ReactNode; label: string; value: string; sub?: string; tone: string; loading?: boolean
}) {
  if (loading) {
    return (
      <div className="rounded-md border border-line bg-panel/80 p-4">
        <div className="skeleton h-3 w-20 rounded" />
        <div className="skeleton mt-3 h-7 w-28 rounded" />
      </div>
    )
  }
  return (
    <div className="group rounded-md border border-line bg-panel/80 p-4 transition-colors hover:border-line2">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] tracking-[0.16em] text-fog">{label}</span>
        <span className={tone}>{icon}</span>
      </div>
      <p className={`mt-2 font-mono text-xl font-semibold tabular-nums ${tone}`}>{value}</p>
      <p className="mt-1 truncate text-[11px] text-fog">{sub}</p>
    </div>
  )
}

function MiniFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-sm border border-line bg-ink/50 px-2.5 py-2">
      <p className="font-mono text-[9px] tracking-[0.14em] text-fog">{label}</p>
      <p className="mt-0.5 font-mono text-sm font-semibold text-white">{value}</p>
    </div>
  )
}

function NumField({ label, value, onChange, hint, step = 50 }: {
  label: string; value: number; onChange: (v: number) => void; hint?: string; step?: number
}) {
  return (
    <label className="block" title={hint}>
      <span className="flex items-center justify-between font-mono text-[10px] tracking-[0.08em] text-mist">
        {label}
      </span>
      <input
        type="number"
        value={value}
        step={step}
        min={0}
        onChange={(e) => {
          const v = Number(e.target.value)
          if (!Number.isNaN(v) && v >= 0) onChange(v)
        }}
        className="mt-1 w-full rounded-md border border-line2 bg-ink px-3 py-2 font-mono text-sm text-white outline-none transition-colors focus:border-cyan-dim"
      />
    </label>
  )
}

export const __impactIcons = {}
