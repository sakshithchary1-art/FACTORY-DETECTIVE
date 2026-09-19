// Production Flow — interactive plant map + station detail from real Model 3 data.

import { useEffect, useState } from 'react'
import { GitBranch, Database, Box, Wrench, ArrowRight, X } from 'lucide-react'
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, BarChart, Bar,
} from 'recharts'
import { api } from '../services/api'
import { useStore } from '../store'
import { Panel, Chip, StatusBadge, Skeleton, chartTooltipStyle } from '../components/ui'
import { fmtInt, fmtNum, fmtPct } from '../utils/format'

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
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState(null)

  useEffect(() => {
    api.stations()
      .then((s) => { setStations(s.stations); setLoading(false) })
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
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-white tracking-tight flex items-center gap-2">
            <GitBranch size={18} className="text-neon" /> Production Flow
          </h2>
          <p className="text-xs text-fog">
            Blanking → Pressing → Assembly → Painting → Quality · every value from Model 3
          </p>
        </div>
        <Chip label="DERIVED · 605,620 events" tone="cyan" />
      </div>

      {err && <div className="glass border-red/40 px-5 py-4 text-sm text-red">{err}</div>}
      {loading && <Skeleton className="h-72" />}

      {stations && (
        <Panel title="Plant Process Map" icon={<Wrench size={16} />}
          right={
            <div className="hidden items-center gap-3 text-[9.5px] text-fog md:flex">
              <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-green" />&lt;70%</span>
              <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-cyan" />70–85%</span>
              <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-amber" />85–95%</span>
              <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-red" />≥95%</span>
            </div>
          }>
          <PlantMap stations={byId} selected={selectedStation} onSelect={setSelectedStation} />
        </Panel>
      )}

      {/* detail panel */}
      {selectedStation && sel && (
        <Panel
          title={selDetail ? `STATION DETAIL — ${selDetail.name.toUpperCase()}` : `STATION DETAIL — ${sel.name.toUpperCase()}`}
          icon={<Database size={16} />}
          right={<button onClick={() => setSelectedStation(null)} className="text-fog hover:text-white"><X size={14} /></button>}
        >
          {detail === null ? (
            <Skeleton className="h-52" />
          ) : detail.error ? (
            <p className="text-xs text-red">{detail.error}</p>
          ) : (
            <div className="grid gap-5 lg:grid-cols-2">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                  <Stat label="Utilization" value={fmtPct(selDetail?.utilization)} tone="text-cyan" />
                  <Stat label="Util p95" value={fmtPct(selDetail?.utilization_p95)} />
                  <Stat label="Queue mean" value={selDetail?.queue_mean != null ? fmtNum(selDetail.queue_mean, 1) : 'no queue field'} />
                  <Stat label="Queue p95" value={selDetail?.queue_p95 != null ? fmtNum(selDetail.queue_p95, 1) : '—'} />
                  <Stat label="Cycle" value={selDetail?.cycle_mean != null ? fmtInt(selDetail.cycle_mean) : 'n/a'} sub={selDetail?.cycle_mean != null ? 'c_Cycle (event units)' : undefined} />
                  <Stat label="Waiting" value={selDetail?.wait_mean != null ? fmtNum(selDetail.wait_mean, 2) : 'n/a'} />
                </div>
                <div className="flex items-center justify-between rounded-xl border border-line bg-navy-850/60 px-4 py-3">
                  <span className="text-xs text-fog">Status (transparent thresholds)</span>
                  <StatusBadge status={utilStatus(selDetail?.utilization)} />
                </div>
                {Object.keys(detail.sku_counters || {}).length > 0 && (
                  <div className="rounded-xl border border-line bg-navy-850/60 p-4">
                    <p className="mb-2 text-[10px] uppercase tracking-wider text-fog">Associated SKU production (mean/run)</p>
                    <div className="h-32">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={Object.entries(detail.sku_counters).map(([k, v]) => ({ sku: k, units: v.mean }))}
                          margin={{ top: 4, right: 4, left: -18, bottom: 0 }}
                        >
                          <CartesianGrid stroke="#1c2444" strokeDasharray="3 6" vertical={false} />
                          <XAxis dataKey="sku" tick={{ fill: '#7d8bb0', fontSize: 9 }} stroke="#293357" />
                          <YAxis tick={{ fill: '#7d8bb0', fontSize: 9 }} stroke="#293357" />
                          <Tooltip contentStyle={chartTooltipStyle()} formatter={(v) => [fmtInt(v), 'units']} />
                          <Bar dataKey="units" fill="#4f7cff" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <p className="mt-1 font-mono text-[9px] text-fog/70">
                      {Object.values(detail.sku_counters)[0]?.column} family
                    </p>
                  </div>
                )}
                <button
                  onClick={() => navigate('simulate')}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-neon to-purple py-2.5 text-xs font-semibold text-white glow-neon"
                >
                  SIMULATE A CHANGE AT THIS STATION <ArrowRight size={12} />
                </button>
              </div>

              <div className="space-y-4">
                {detail.series?.utilization?.available && (
                  <div>
                    <p className="mb-1.5 flex items-center justify-between text-[10px] uppercase tracking-wider text-fog">
                      <span>Utilization trend</span>
                      <span className="font-mono normal-case">{detail.series.utilization.column}</span>
                    </p>
                    <div className="h-44">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={detail.series.utilization.points} margin={{ top: 4, right: 4, left: -22, bottom: 0 }}>
                          <defs>
                            <linearGradient id="uGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#38d9f5" stopOpacity={0.45} />
                              <stop offset="100%" stopColor="#38d9f5" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid stroke="#1c2444" strokeDasharray="3 6" vertical={false} />
                          <XAxis dataKey="t" tick={{ fill: '#7d8bb0', fontSize: 8 }} stroke="#293357" tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                          <YAxis tick={{ fill: '#7d8bb0', fontSize: 8 }} stroke="#293357" tickFormatter={(v) => v.toFixed(1)} />
                          <Tooltip contentStyle={chartTooltipStyle()} labelFormatter={(v) => `Event #${v}`} formatter={(v) => [fmtPct(v * 100, 1), 'utilization']} />
                          <Area type="monotone" dataKey="v" stroke="#38d9f5" strokeWidth={1.6} fill="url(#uGrad)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}
                {detail.series?.queue?.available && (
                  <div>
                    <p className="mb-1.5 flex items-center justify-between text-[10px] uppercase tracking-wider text-fog">
                      <span>Queue trend</span>
                      <span className="font-mono normal-case">{detail.series.queue.column}</span>
                    </p>
                    <div className="h-40">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={detail.series.queue.points} margin={{ top: 4, right: 4, left: -22, bottom: 0 }}>
                          <defs>
                            <linearGradient id="qGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.45} />
                              <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid stroke="#1c2444" strokeDasharray="3 6" vertical={false} />
                          <XAxis dataKey="t" tick={{ fill: '#7d8bb0', fontSize: 8 }} stroke="#293357" tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                          <YAxis tick={{ fill: '#7d8bb0', fontSize: 8 }} stroke="#293357" />
                          <Tooltip contentStyle={chartTooltipStyle()} labelFormatter={(v) => `Event #${v}`} formatter={(v) => [fmtNum(v, 1), 'units']} />
                          <Area type="monotone" dataKey="v" stroke="#8b5cf6" strokeWidth={1.6} fill="url(#qGrad)" />
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

function Stat({ label, value, tone = 'text-white', sub }) {
  return (
    <div className="rounded-xl border border-line bg-navy-850/70 px-3.5 py-2.5">
      <p className="text-[9.5px] uppercase tracking-wider text-fog">{label}</p>
      <p className={`mt-0.5 font-mono text-lg font-semibold ${tone}`}>{value}</p>
      {sub && <p className="text-[9px] text-fog/80">{sub}</p>}
    </div>
  )
}

function PlantMap({ stations, selected, onSelect }) {
  const utilColor = (u) => (u == null ? '#7d8bb0' : u >= 95 ? '#f4506c' : u >= 85 ? '#f5a623' : u >= 70 ? '#38d9f5' : '#34d399')

  const Node = ({ id, x, y, w = 108, h = 58, label }) => {
    const s = stations.get(id)
    if (!s) return null
    const color = utilColor(s.utilization)
    const isSel = selected === id
    return (
      <g onClick={() => onSelect(id)} className="cursor-pointer">
        <rect x={x} y={y} width={w} height={h} rx={12}
          fill={isSel ? 'rgba(79,124,255,0.12)' : 'rgba(14,19,39,0.9)'}
          stroke={isSel ? '#4f7cff' : color} strokeWidth={isSel ? 2 : 1.2}
          className={isSel ? '' : 'transition-all hover:stroke-neon'} />
        <text x={x + w / 2} y={y + 18} textAnchor="middle" fontSize={10} fontWeight={700} fill="#dfe6f7" fontFamily="Inter, sans-serif">
          {label || s.name}
        </text>
        <text x={x + w / 2} y={y + 34} textAnchor="middle" fontSize={9.5} fill={color} fontFamily="JetBrains Mono, monospace">
          {s.utilization != null ? `${s.utilization.toFixed(1)}% util` : 'util n/a'}
        </text>
        <text x={x + w / 2} y={y + 47} textAnchor="middle" fontSize={8.5} fill="#7d8bb0" fontFamily="JetBrains Mono, monospace">
          {s.queue_mean != null ? `Q ${s.queue_mean.toFixed(1)}` : 'no queue field'}
        </text>
        {s.utilization >= 85 && (
          <circle cx={x + w - 9} cy={y + 9} r={4} fill="#f4506c" className="pulse-soft" />
        )}
      </g>
    )
  }

  const Flow = ({ d }) => (
    <path d={d} fill="none" stroke="#293357" strokeWidth={1.4} className="flow-line" />
  )

  return (
    <div className="overflow-x-auto">
      <svg viewBox="0 0 1000 470" className="mx-auto block h-auto w-full min-w-[860px]">
        {/* raw material */}
        <g>
          <rect x={40} y={64} width={64} height={44} rx={12} fill="rgba(14,19,39,0.9)" stroke="#293357" />
          <text x={72} y={90} textAnchor="middle" fontSize={9} fill="#7d8bb0" fontFamily="Inter">RAW</text>
          <Flow d="M 104 86 L 130 86 L 130 130 L 118 130" />
        </g>

        <Node id="BLANKING" x={10} y={102} w={108} h={56} label="Blanking" />
        <Flow d="M 118 158 L 118 196 L 118 196" />

        {/* presses */}
        {[1, 2, 3, 4].map((i) => {
          const x = 66 + (i - 1) * 150
          return (
            <g key={`p${i}`}>
              <Flow d={`M 64 158 L 64 186 L ${x + 54} 186 L ${x + 54} 208`} />
              <Node id={`PRESS${i}`} x={x} y={208} w={108} h={58} label={`Press ${i}`} />
              <Flow d={`M ${x + 54} 266 L ${x + 54} 296`} />
            </g>
          )
        })}
        <line x1={120} y1={296} x2={570} y2={296} stroke="#293357" strokeWidth={1.4} />

        {/* cells */}
        {[1, 2, 3, 4].map((i) => {
          const x = 96 + (i - 1) * 132
          return (
            <g key={`c${i}`}>
              <Flow d={`M 490 296 L ${x + 50} 296 L ${x + 50} 318`} />
              <Node id={`CELL${i}`} x={x} y={318} w={100} h={56} label={`Cell ${i}`} />
              <Flow d={`M ${x + 50} 374 L ${x + 50} 402`} />
            </g>
          )
        })}
        <line x1={146} y1={402} x2={492} y2={402} stroke="#293357" strokeWidth={1.4} />
        <Flow d="M 490 402 L 620 402 L 620 430" />

        {/* paint */}
        <Node id="PAINT1" x={570} y={318} w={100} h={50} label="Paint 1" />
        <Node id="PAINT2" x={690} y={318} w={100} h={50} label="Paint 2" />
        <Flow d="M 670 343 L 690 343" />
        <Flow d="M 740 368 L 740 388 L 790 388 L 790 396" />

        {/* quality */}
        <Node id="QUALITY" x={738} y={396} w={104} h={56} />

        {/* forklift rail */}
        <Flow d="M 240 318 L 720 318 L 720 210" />
        <Node id="FORKLIFT" x={666} y={148} w={108} h={58} label="Forklift Fleet" />
        <text x={720} y={138} textAnchor="middle" fontSize={8.5} fill="#7d8bb0" fontFamily="Inter">MATERIAL HANDLING</text>
        <Flow d="M 774 177 L 850 177" />
        <text x={905} y={181} textAnchor="middle" fontSize={9} fill="#7d8bb0" fontFamily="Inter">→ PAINT</text>

        {/* finished goods */}
        <g>
          <rect x={880} y={408} width={70} height={48} rx={12} fill="rgba(14,19,39,0.9)" stroke="#293357" />
          <text x={915} y={435} textAnchor="middle" fontSize={9} fill="#7d8bb0" fontFamily="Inter">FINISHED</text>
        </g>
        <Flow d="M 842 424 L 880 430" />
      </svg>
    </div>
  )
}

export const __flowIcons = { Box }
