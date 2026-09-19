// Overview — the command center, styled after the reference, powered by real data.

import { useEffect, useState } from 'react'
import {
  Gauge, Activity, TriangleAlert, Layers, Zap, ArrowRight, Clock,
  ShieldCheck, GitBranch, FlaskConical, FileText, ScanSearch, Wrench,
} from 'lucide-react'
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts'
import { api } from '../services/api'
import { useStore } from '../store'
import { Panel, KpiCard, Chip, StatusBadge, ViewDetails, Skeleton, chartTooltipStyle } from '../components/ui'
import { FlowStrip } from '../components/FlowStrip'
import { fmtInt, fmtNum, fmtPct } from '../utils/format'

export function Overview() {
  const { navigate, setSelectedStation, logActivity, backendOnline } = useStore()
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
  const healthOrder = ['HEALTHY', 'WATCH', 'WARNING', 'CRITICAL']

  return (
    <div className="space-y-5">
      {/* KPI row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          loading={loading} icon={<Gauge size={15} />} tone="cyan"
          label="FACTORY UTILIZATION"
          value={fmtPct(kpis?.factory_utilization, 1)}
          sub={`Mean of ${stations?.length || '—'} station utilization fields · Model 3`}
          onClick={() => navigate('flow')}
        />
        <KpiCard
          loading={loading} icon={<Activity size={15} />} tone="neon"
          label="THROUGHPUT"
          value={fmtInt(kpis?.throughput_mean)} unit="products/run"
          sub="c_TotalProducts mean · 605,620 events"
          onClick={() => navigate('investigate')}
        />
        <KpiCard
          loading={loading} icon={<Layers size={15} />} tone="purple"
          label="CRITICAL QUEUE"
          value={kpis?.critical_queue ? fmtNum(kpis.critical_queue.p95, 0) : '—'} unit="units p95"
          sub={kpis?.critical_queue ? `${kpis.critical_queue.queue} · peak ${fmtInt(kpis.critical_queue.max)}` : ''}
          onClick={() => navigate('investigate')}
        />
        <KpiCard
          loading={loading} icon={<TriangleAlert size={15} />} tone={bkStation?.score > 60 ? 'red' : 'amber'}
          label="BOTTLENECK"
          value={bkStation?.name || '—'}
          sub={bkStation ? `ForgeSite Bottleneck Score ${fmtNum(bkStation.score, 0)}/100` : ''}
          onClick={() => navigate('investigate')}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        {/* left/main column */}
        <div className="space-y-5 xl:col-span-2">
          {/* production flow */}
          <Panel
            title="Production Flow" icon={<GitBranch size={16} />}
            right={<ViewDetails onClick={() => navigate('flow')} />}
          >
            {stations ? (
              <FlowStrip
                stations={stations}
                bottleneckId={bkStation?.id}
                onSelect={(id) => { setSelectedStation(id); navigate('flow') }}
                compact
              />
            ) : <Skeleton className="h-28" />}
            <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-[10.5px] text-fog">
              <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full" style={{ background: '#34d399' }} /> &lt;70%</span>
              <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full" style={{ background: '#38d9f5' }} /> 70–85%</span>
              <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full" style={{ background: '#f5a623' }} /> 85–95%</span>
              <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full" style={{ background: '#f4506c' }} /> ≥95%</span>
              <span className="ml-auto italic">Utilization rings · real Model 3 means</span>
            </div>
          </Panel>

          {/* anomaly banner */}
          {anomaly ? (
            <div className="glass edge-top flex flex-wrap items-center gap-4 border-red/40 bg-gradient-to-r from-red/10 to-purple/10 px-5 py-4 glow-red">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-red/20 text-red">
                <TriangleAlert size={20} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-semibold text-white">
                  AI detected an anomaly: {anomaly.metric.replace(/_/g, ' ')}
                </p>
                <p className="mt-0.5 text-xs leading-relaxed text-mist">
                  {anomaly.n_anomalies.toLocaleString()} outlier events ({fmtNum(anomaly.anomaly_rate_pct, 2)}% of{' '}
                  {anomaly.n_total.toLocaleString()}) via the {anomaly.method} method — associated with{' '}
                  {bkStation?.name || 'a loaded station'} on the bottleneck ranking.
                </p>
              </div>
              <button
                onClick={() => navigate('investigate')}
                className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-neon to-purple px-4 py-2 text-xs font-semibold text-white glow-neon transition-transform hover:scale-[1.02]"
              >
                Investigate <ArrowRight size={13} />
              </button>
            </div>
          ) : loading ? (
            <Skeleton className="h-20" />
          ) : null}

          {/* trend + health */}
          <div className="grid gap-5 lg:grid-cols-2">
            <Panel title="Throughput Trend" icon={<Activity size={16} />}
              right={<Chip label="DERIVED" tone="cyan" />}>
              {trend?.available ? (
                <div className="h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={trend.points} margin={{ top: 6, right: 6, left: -12, bottom: 0 }}>
                      <defs>
                        <linearGradient id="tpGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#4f7cff" stopOpacity={0.5} />
                          <stop offset="100%" stopColor="#4f7cff" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="#1c2444" strokeDasharray="3 6" vertical={false} />
                      <XAxis dataKey="t" tick={{ fill: '#7d8bb0', fontSize: 9 }} stroke="#293357" tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                      <YAxis tick={{ fill: '#7d8bb0', fontSize: 9 }} stroke="#293357" tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                      <Tooltip contentStyle={chartTooltipStyle()} labelFormatter={(v) => `Event #${v}`}
                        formatter={(v) => [fmtInt(v), 'Total products']} />
                      <Area type="monotone" dataKey="v" stroke="#38d9f5" strokeWidth={1.8} fill="url(#tpGrad)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : <Skeleton className="h-52" />}
              <p className="mt-1.5 text-center text-[10.5px] text-fog">c_TotalProducts across the event stream (downsampled)</p>
            </Panel>

            <Panel title="Factory Health" icon={<ShieldCheck size={16} />}
              right={health && <StatusBadge status={health.overall} />}>
              {health ? (
                <div className="space-y-3">
                  <HealthGauge score={health.score} overall={health.overall} />
                  {Object.entries(health.components).map(([k, v]) => (
                    <div key={k} className="flex items-center justify-between gap-3 text-xs">
                      <span className="text-mist">{k}</span>
                      <div className="flex items-center gap-2">
                        <span className="hidden font-mono text-[10px] text-fog md:inline">{componentDetail(health.detail, k)}</span>
                        <StatusBadge status={v} />
                      </div>
                    </div>
                  ))}
                  <p className="border-t border-line pt-2 text-[10.5px] leading-relaxed text-fog">
                    Transparent thresholds: utilization bands at 70/85/95%, queue pressure vs fleet
                    median, waiting-to-value-added ratio, cycle CV. All derived from Model 3.
                  </p>
                </div>
              ) : <Skeleton className="h-52" />}
            </Panel>
          </div>
        </div>

        {/* right rail */}
        <div className="space-y-5">
          <Panel title="Quick Actions" icon={<Zap size={16} />}>
            <div className="space-y-2.5">
              <QuickAction icon={<ScanSearch size={15} />} title="Investigate Anomaly"
                desc={anomaly ? `${anomaly.metric} flagged` : 'Open the investigation workspace'}
                onClick={() => navigate('investigate')} />
              <QuickAction icon={<GitBranch size={15} />} title="Explore Production Flow"
                desc="13 stations from Model 3"
                onClick={() => navigate('flow')} />
              <QuickAction icon={<FlaskConical size={15} />} title="Run Simulation"
                desc="Project a process change"
                onClick={() => navigate('simulate')} />
              <QuickAction icon={<FileText size={15} />} title="Generate Report"
                desc="Full investigation dossier"
                onClick={() => navigate('reports')} />
            </div>
          </Panel>

          <Panel title="Recent Activity" icon={<Clock size={16} />} right={<Chip label="LIVE" tone="green" />}>
            <ActivityFeed />
          </Panel>

          <Panel title="AI Investigation Snapshot" icon={<Wrench size={16} />}
            right={<ViewDetails onClick={() => navigate('investigate')} label="Open" />}>
            {inv ? (
              <div className="space-y-2.5 text-xs">
                <Row label="Investigation" value={inv.id} />
                <Row label="Severity" value={
                  <Chip label={inv.severity} tone={inv.severity === 'CRITICAL' ? 'red' : 'amber'} />
                } />
                <Row label="Affected process" value={inv.affected_process?.name || '—'} />
                <Row label="Confidence" value={fmtPct(inv.confidence, 0)} />
                <Row label="Anomaly metric" value={anomaly?.metric?.replace(/_/g, ' ') || '—'} />
                <button
                  onClick={() => navigate('investigate')}
                  className="mt-1 w-full rounded-lg border border-neon/40 bg-neon/10 py-2 text-xs font-semibold text-neon transition-colors hover:bg-neon/20"
                >
                  OPEN FULL INVESTIGATION →
                </button>
              </div>
            ) : <Skeleton className="h-44" />}
          </Panel>
        </div>
      </div>

      {err && (
        <div className="glass border-red/40 px-5 py-4 text-sm text-red">
          {err}
        </div>
      )}
      {backendOnline === false && (
        <div className="glass border-red/40 px-5 py-4 text-sm text-red">
          Backend unreachable — start the ForgeSite API: <span className="font-mono">uvicorn main:app --port 8010</span>
        </div>
      )}
    </div>
  )
}

function componentDetail(detail, key) {
  if (!detail) return ''
  if (key === 'Queue Pressure') return `p95 max ${fmtNum(detail.queue_p95_max, 0)} · ${fmtNum(detail.queue_ratio_to_median, 1)}× median`
  if (key === 'Waiting Time') return `wait/VA ratio ${fmtNum(detail.wait_to_va_ratio, 2)}`
  if (key === 'Cycle Performance') return `cycle CV ${fmtNum(detail.cycle_cv, 2)}`
  return `util mean ${fmtPct(detail.utilization_mean, 1)}`
}

export function HealthGauge({ score, overall }) {
  const color = overall === 'CRITICAL' ? '#f4506c' : overall === 'WARNING' ? '#f5a623'
    : overall === 'WATCH' ? '#38d9f5' : '#34d399'
  const C = 2 * Math.PI * 40
  return (
    <div className="flex items-center gap-4">
      <div className="relative grid h-24 w-24 place-items-center">
        <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90">
          <circle cx="50" cy="50" r="40" fill="none" stroke="#1c2444" strokeWidth="8" />
          <circle cx="50" cy="50" r="40" fill="none" stroke={color} strokeWidth="8" strokeLinecap="round"
            strokeDasharray={`${score / 100 * C} ${C}`} style={{ transition: 'stroke-dasharray 1s ease' }} />
        </svg>
        <div className="text-center">
          <p className="text-xl font-bold" style={{ color }}>{score}</p>
          <p className="text-[9px] text-fog tracking-wider">/ 100</p>
        </div>
      </div>
      <div>
        <StatusBadge status={overall} />
        <p className="mt-1.5 max-w-[180px] text-[10.5px] leading-relaxed text-fog">
          Composite of flow, utilization, queue, waiting and cycle signals
        </p>
      </div>
    </div>
  )
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-line/60 pb-2">
      <span className="text-fog">{label}</span>
      <span className="text-right font-medium text-white">{value}</span>
    </div>
  )
}

function QuickAction({ icon, title, desc, onClick }) {
  return (
    <button
      onClick={onClick}
      className="group flex w-full items-center gap-3 rounded-xl border border-line2/70 bg-navy-800/50 px-3.5 py-3 text-left transition-all hover:border-neon/50 hover:bg-navy-800"
    >
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-neon/15 text-cyan">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-medium text-white">{title}</span>
        <span className="block truncate text-[11px] text-fog">{desc}</span>
      </span>
      <ArrowRight size={14} className="shrink-0 text-fog transition-all group-hover:translate-x-0.5 group-hover:text-cyan" />
    </button>
  )
}

function ActivityFeed() {
  const { activity } = useStore()
  if (activity.length === 0) {
    return <p className="py-4 text-center text-xs text-fog">Interact with ForgeSite — events will appear here in real time.</p>
  }
  const dot = { anomaly: '#f4506c', bottleneck: '#4f7cff', analysis: '#38d9f5', simulation: '#8b5cf6', report: '#34d399' }
  return (
    <ol className="relative space-y-3.5 pl-4">
      <span className="absolute inset-y-1 left-[5px] w-px bg-line2" />
      {activity.map((a) => (
        <li key={a.id} className="relative fade-up">
          <span className="absolute -left-4 top-1 h-2.5 w-2.5 rounded-full ring-4 ring-navy-900"
            style={{ background: dot[a.kind] || '#4f7cff' }} />
          <p className="text-xs font-medium text-mist">{a.title}</p>
          <p className="text-[10.5px] text-fog">
            {a.detail} · {new Date(a.ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
          </p>
        </li>
      ))}
    </ol>
  )
}
