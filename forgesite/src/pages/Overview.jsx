// Overview — FORGE SIGHT operations screen.
// Hierarchy: KPI row → production flow (visual anchor) → trend + health →
// investigation snapshot. Flat lists inside panels; icons only where useful.

import { useEffect, useState } from 'react'
import {
  Activity, TriangleAlert, Zap, ArrowRight, Clock,
  ShieldCheck, GitBranch, FlaskConical, FileText, ScanSearch,
} from 'lucide-react'
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts'
import { api } from '../services/api'
import { useStore } from '../store'
import { Panel, KpiCard, Chip, StatusBadge, ViewDetails, Skeleton, SectionTitle, CHART, chartTooltipStyle } from '../components/ui'
import { CircularProgress, LoadingLine, Term } from '../components/Feedback'
import { FlowStrip } from '../components/FlowStrip'
import { fmtInt, fmtCompact, fmtNum, fmtPct } from '../utils/format'

export function Overview() {
  const { navigate, setSelectedStation, logActivity } = useStore()
  const [kpis, setKpis] = useState(null)
  const [health, setHealth] = useState(null)
  const [stations, setStations] = useState(null)
  const [bk, setBk] = useState(null)
  const [inv, setInv] = useState(null)
  const [trend, setTrend] = useState(null)
  const [err, setErr] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    Promise.all([
      api.kpis(), api.factoryHealth(), api.stations(),
      api.bottlenecks(), api.investigation(),
      api.series(3, 'c_TotalProducts', 160).catch(() => null),
    ])
      .then(([k, h, s, b, i, t]) => {
        if (!alive) return
        setKpis(k); setHealth(h); setStations(s.stations); setBk(b); setInv(i); setTrend(t)
        setLoading(false)
        logActivity('anomaly', 'Anomaly scan completed', i?.anomaly ? `${i.anomaly.metric} flagged ${i.anomaly.method}` : 'No dominant anomaly')
      })
      .catch((e) => { if (alive) { setErr(e.message); setLoading(false) } })
    return () => { alive = false }
  }, [logActivity])

  const bkStation = bk?.top
  const anomaly = inv?.anomaly
  const healthScore = health?.score ?? 0
  const healthStatus =
    healthScore >= 75 ? 'healthy' : healthScore >= 55 ? 'normal' : healthScore >= 35 ? 'warning' : 'critical'

  if (loading && !kpis && !err) {
    return (
      <div className="pt-2">
        <LoadingLine label="Preparing production analysis" className="max-w-md" />
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-[92px]" />)}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {err && <div className="glass border-red/40 px-4 py-3 text-[13px] text-red">{err}</div>}

      {/* 1 — key figures */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          loading={loading}
          label="Machine Usage"
          value={fmtPct(kpis?.factory_utilization, 1)}
          sub={`Mean of ${stations?.length || '—'} stations`}
          onClick={() => navigate('flow')}
        />
        <KpiCard
          loading={loading}
          label="Production Rate"
          value={fmtCompact(kpis?.throughput_mean)}
          unit="products/run"
          sub="c_TotalProducts mean"
          onClick={() => navigate('investigate')}
        />
        <KpiCard
          loading={loading}
          label="Highest Waiting Area"
          value={kpis?.critical_queue ? fmtNum(kpis.critical_queue.p95, 0) : '—'}
          unit="units p95"
          sub={kpis?.critical_queue ? `${kpis.critical_queue.queue} · peak ${fmtInt(kpis.critical_queue.max)}` : ''}
          onClick={() => navigate('investigate')}
        />
        <KpiCard
          loading={loading}
          label="Production Constraint"
          value={bkStation?.name || '—'}
          sub={bkStation ? `Constraint Risk ${fmtNum(bkStation.score, 0)}/100` : ''}
          tone={bkStation?.score > 60 ? 'red' : 'ink'}
          onClick={() => navigate('investigate')}
        />
      </div>

      {/* 2 — production flow (visual anchor) */}
      <section>
        <SectionTitle
          title="Production Flow"
          note="Raw material → Blanking → Press → Assembly → Paint → Quality · values from the Detailed Factory Data"
          right={<ViewDetails onClick={() => navigate('flow')} label="Open Production" />}
        />
        <div className="glass p-3">
          {stations ? (
            <FlowStrip
              stations={stations}
              bottleneckId={bkStation?.id}
              onSelect={(id) => { setSelectedStation(id); navigate('flow') }}
              compact
              flowProgress={kpis?.flow_progress}
            />
          ) : <Skeleton className="h-24" />}
          <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line px-1 pt-2 text-[10px] text-fog">
            <span className="flex items-center gap-1.5"><i className="h-1.5 w-1.5 rounded-full" style={{ background: '#405443' }} /> &lt;70%</span>
            <span className="flex items-center gap-1.5"><i className="h-1.5 w-1.5 rounded-full" style={{ background: '#A88952' }} /> 70–85%</span>
            <span className="flex items-center gap-1.5"><i className="h-1.5 w-1.5 rounded-full" style={{ background: '#A6622B' }} /> 85–95%</span>
            <span className="flex items-center gap-1.5"><i className="h-1.5 w-1.5 rounded-full" style={{ background: '#6E3B42' }} /> ≥95%</span>
            <span className="ml-auto"><Term tech="Utilization">Machine usage</Term> per station · live means</span>
          </div>
        </div>
      </section>

      {/* 3 — trend + health */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Production Rate Over Time" right={<Chip label="DERIVED" tone="cyan" />}>
          {trend?.available ? (
            <>
              <div style={{ height: CHART.height }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trend.points} margin={{ top: 4, right: 4, left: -4, bottom: 0 }}>
                    <defs>
                      <linearGradient id="tpGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={CHART.series.blue} stopOpacity={0.14} />
                        <stop offset="100%" stopColor={CHART.series.blue} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke={CHART.grid} strokeDasharray="2 4" vertical={false} />
                    <XAxis dataKey="t" tick={CHART.tick} stroke={CHART.axis} minTickGap={56} tickFormatter={(v) => fmtCompact(v, '')} />
                    <YAxis tick={CHART.tick} stroke={CHART.axis} width={46} tickFormatter={(v) => fmtCompact(v, '')} />
                    <Tooltip contentStyle={chartTooltipStyle()} labelFormatter={(v) => `Event #${fmtInt(v)}`}
                      formatter={(v) => [fmtInt(v), 'Total products']} />
                    <Area type="monotone" dataKey="v" stroke={CHART.series.blue} strokeWidth={1.5} fill="url(#tpGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <p className="mt-1 text-[10.5px] text-fog">Total products across the event stream (downsampled)</p>
            </>
          ) : <Skeleton style={{}} className="h-[220px]" />}
        </Panel>

        <Panel title="Factory Health" right={health && <StatusBadge status={health.overall} />}>
          {health ? (
            <div className="space-y-3">
              <div className="flex items-center gap-4">
                <CircularProgress
                  value={healthScore} size={88}
                  status={healthStatus}
                  label="Production Health"
                />
                <div className="min-w-0 flex-1">
                  <ul className="divide-y divide-line">
                    {Object.entries(health.components).map(([k, v]) => (
                      <li key={k} className="flex items-center justify-between gap-3 py-[5px] text-[11.5px]">
                        <span className="text-mist">{k}</span>
                        <StatusBadge status={v} />
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              <p className="border-t border-line pt-2 text-[10.5px] leading-relaxed text-fog">
                Transparent thresholds: usage bands 70/85/95%, waiting vs fleet median,
                waiting-to-processing ratio, cycle variation. Derived from the Detailed Factory Data.
              </p>
            </div>
          ) : <Skeleton className="h-[220px]" />}
        </Panel>
      </div>

      {/* 4 — investigation + actions + activity */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* current issue */}
        <div className="lg:col-span-2">
          <SectionTitle title="Current Issue" right={inv && <ViewDetails onClick={() => navigate('investigate')} label="Open investigation" />} />
          <div className="glass p-4">
            {inv ? (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <TriangleAlert size={15} className={inv.severity === 'CRITICAL' ? 'text-red' : 'text-amber'} />
                    <p className="text-[13.5px] font-semibold text-ink">
                      {anomaly ? `${anomaly.metric.replace(/_/g, ' ')} outside expected range` : 'No dominant anomaly'}
                    </p>
                    <StatusBadge status={inv.severity} />
                  </div>
                  <span className="tnum text-[11px] text-fog">{inv.id}</span>
                </div>
                {/* evidence chain — short factual rows */}
                <ul className="divide-y divide-line text-[12px]">
                  {inv.evidence.slice(0, 5).map((e) => (
                    <li key={e.label} className="flex items-baseline justify-between gap-3 py-[5px]">
                      <span className="text-mist">{e.label}</span>
                      <span className="flex shrink-0 items-baseline gap-2">
                        <span className="tnum font-semibold text-ink">{e.value}</span>
                        <span className="hidden text-[10.5px] text-fog md:inline">{e.vs_fleet}</span>
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="flex items-center justify-between border-t border-line pt-2.5">
                  <p className="text-[11px] text-fog">
                    Affected station: <span className="font-medium text-mist">{inv.affected_process?.name}</span>
                    {' · '}{fmtInt(inv.time_period?.records)} events
                  </p>
                  <button
                    onClick={() => navigate('investigate')}
                    className="btn-primary flex items-center gap-1.5 px-3 py-1.5 text-[11.5px] font-semibold"
                  >
                    Find the cause <ArrowRight size={11} />
                  </button>
                </div>
              </div>
            ) : <Skeleton className="h-48" />}
          </div>
        </div>

        {/* right column: actions + activity */}
        <div className="space-y-4">
          <Panel title="Quick Actions" icon={<Zap size={13} />}>
            <ul className="space-y-1">
              <ActionRow icon={<ScanSearch size={13} />} label="Investigate anomaly" desc={anomaly ? `${anomaly.metric} flagged` : undefined} onClick={() => navigate('investigate')} />
              <ActionRow icon={<GitBranch size={13} />} label="Explore production" onClick={() => navigate('flow')} />
              <ActionRow icon={<FlaskConical size={13} />} label="Run a What-If Test" onClick={() => navigate('simulate')} />
              <ActionRow icon={<FileText size={13} />} label="Generate AI Summary" onClick={() => navigate('reports')} />
            </ul>
          </Panel>

          <Panel title="Recent Activity" icon={<Clock size={13} />}>
            <ActivityFeed />
          </Panel>

          <Panel title="Analysis Notes" icon={<ShieldCheck size={13} />}>
            <ul className="space-y-1.5 text-[11px] leading-relaxed text-fog">
              <li>Evidence confidence <span className="tnum font-semibold text-mist">{fmtPct(inv?.confidence, 0)}</span> — agreement across independent signals, not a validated classifier score.</li>
              <li>Constraint ranking uses a transparent multi-signal score (weights configurable in the backend).</li>
            </ul>
          </Panel>
        </div>
      </div>
    </div>
  )
}

function ActionRow({ icon, label, desc, onClick }) {
  return (
    <li>
      <button
        onClick={onClick}
        className="group flex w-full items-center gap-2.5 rounded-md px-2 py-[7px] text-left transition-colors hover:bg-navy-850"
      >
        <span className="shrink-0 text-fog">{icon}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[12.5px] font-medium text-ink">{label}</span>
          {desc && <span className="block truncate text-[10.5px] text-fog">{desc}</span>}
        </span>
        <ArrowRight size={12} className="shrink-0 text-line2 transition-colors group-hover:text-neon" />
      </button>
    </li>
  )
}

function ActivityFeed() {
  const { activity } = useStore()
  if (activity.length === 0) {
    return <p className="py-3 text-center text-[11px] text-fog">Interact with Forge SIGHT — events appear here in real time.</p>
  }
  const dot = { anomaly: '#6E3B42', bottleneck: '#26364A', analysis: '#A88952', simulation: '#6E3B42', report: '#405443' }
  return (
    <ol className="relative space-y-2.5 pl-3.5">
      <span className="absolute inset-y-1 left-[4px] w-px bg-line" />
      {activity.map((a) => (
        <li key={a.id} className="fade-up relative">
          <span className="absolute -left-3.5 top-[5px] h-2 w-2 rounded-full ring-2 ring-white"
            style={{ background: dot[a.kind] || '#26364A' }} />
          <p className="text-[12px] font-medium text-mist">{a.title}</p>
          <p className="tnum text-[10px] text-fog">
            {a.detail} · {new Date(a.ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
          </p>
        </li>
      ))}
    </ol>
  )
}
