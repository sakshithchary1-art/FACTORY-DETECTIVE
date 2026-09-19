// PAGE 8 — DATASET EXPLORER: prove the system runs on the supplied dataset.

import { useEffect, useState } from 'react'
import { Database, FileSearch, Search, Table2 } from 'lucide-react'
import {
  Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { api } from '../api'
import { Badge, Panel, SkeletonBlock } from '../components/ui'
import { fmtInt, fmtNum } from '../lib/ui'
import type { CorrPair, DatasetInfo, FeatureTable, MatInfo, ModelSummary, ScatterData } from '../types'

type ModelId = 1 | 2 | 3

const SCATTER_CHOICES: Record<ModelId, { x: string; y: string }[]> = {
  1: [
    { x: 'Demand', y: 'Parts per hour' },
    { x: 'Demand', y: 'Assembly Waiting Time' },
    { x: 'Parts per hour', y: 'Drilling Util' },
  ],
  2: [
    { x: 'Demand', y: 'Entities Out' },
    { x: 'Demand', y: 'Assembly Queue Time' },
    { x: 'Drilling Utilization', y: 'Assembly Utilization' },
  ],
  3: [
    { x: 'Blanking_Util', y: 'c_TotalProducts' },
    { x: 'Cell1_Util', y: 'c_TotalProducts' },
    { x: 'Quality_Queue', y: 'Cell1_Util' },
  ],
}

export function Explorer() {
  const [model, setModel] = useState<ModelId>(1)
  const [summaries, setSummaries] = useState<Record<ModelId, ModelSummary | null>>({ 1: null, 2: null, 3: null })
  const [dsInfo, setDsInfo] = useState<DatasetInfo[] | null>(null)
  const [mat, setMat] = useState<MatInfo | null>(null)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [table, setTable] = useState<FeatureTable | null>(null)
  const [corr, setCorr] = useState<CorrPair[]>([])
  const [scatter, setScatter] = useState<ScatterData | null>(null)
  const [scIdx, setScIdx] = useState(0)

  useEffect(() => {
    Promise.all([api.datasets(), api.modelSummary(1), api.modelSummary(2), api.modelSummary(3)])
      .then(([d, s1, s2, s3]) => {
        setDsInfo(d.datasets); setMat(d.mat)
        setSummaries({ 1: s1, 2: s2, 3: s3 })
      })
      .catch(() => null)
  }, [])

  useEffect(() => { setPage(1) }, [model, search])

  useEffect(() => {
    let alive = true
    setTable(null)
    const t = setTimeout(() => {
      api.modelFeatures(model, search, page, 14)
        .then((t2) => alive && setTable(t2))
        .catch(() => alive && setTable({ available: false, total: 0, page: 1, page_size: 14, items: [] }))
    }, 200)
    return () => { alive = false; clearTimeout(t) }
  }, [model, search, page])

  useEffect(() => {
    let alive = true
    api.modelCorrelations(model).then((c) => alive && setCorr(c.pairs)).catch(() => null)
    const sc = SCATTER_CHOICES[model][scIdx % SCATTER_CHOICES[model].length]
    setScatter(null)
    api.modelScatter(model, sc.x, sc.y)
      .then((s) => alive && setScatter(s))
      .catch(() => alive && setScatter({ available: false, x: '', y: '', r: null, points: [] }))
    return () => { alive = false }
  }, [model, scIdx])

  const summary = summaries[model]

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-mono text-xl font-bold tracking-[0.2em] text-white">DATASET EXPLORER</h1>
          <p className="mt-1 text-sm text-fog">
            Every number in this app traces back to these files — Rockwell Arena
            discrete-event simulation output.
          </p>
        </div>
        <Badge tone="green"><Database size={10} /> REAL DATA</Badge>
      </header>

      {/* dataset files */}
      <div className="grid gap-3 md:grid-cols-4">
        {(dsInfo ?? []).map((d) => (
          <div key={d.id} className="rounded-md border border-line bg-panel/80 p-3.5">
            <div className="flex items-center justify-between">
              <FileSearch size={14} className="text-cyan-300" />
              <Badge tone={d.available ? 'green' : 'red'}>{d.available ? 'LOADED' : 'MISSING'}</Badge>
            </div>
            <p className="mt-2 text-[11px] font-semibold leading-snug text-mist">{d.name}</p>
            <p className="mt-1 font-mono text-[9.5px] text-fog">{d.file}</p>
            {d.size_bytes != null && (
              <p className="mt-1 font-mono text-[9.5px] text-fog">{(d.size_bytes / 1e6).toFixed(1)} MB</p>
            )}
          </div>
        ))}
      </div>

      {/* model tabs */}
      <div className="flex flex-wrap gap-2">
        {([1, 2, 3] as ModelId[]).map((m) => (
          <button
            key={m}
            onClick={() => { setModel(m); setScIdx(0) }}
            className={`rounded-md border px-4 py-2 font-mono text-[11px] font-semibold tracking-[0.12em] transition-all ${
              model === m
                ? 'border-cyan-500/60 bg-cyan-500/15 text-cyan-200'
                : 'border-line2 bg-panel2 text-fog hover:text-mist'
            }`}
          >
            MODEL {m}
            <span className="ml-2 font-normal text-fog">
              {m === 3 ? '77 feat · 605,620 rows' : '3000 runs'}
            </span>
          </button>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        {/* feature table */}
        <Panel
          title={`FEATURES — MODEL ${model}`}
          subtitle={table ? `${table.total} columns` : 'loading'}
          tag="REAL DATA"
          className="xl:col-span-2"
          right={
            <div className="relative">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-fog" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="search columns…"
                className="w-44 rounded-sm border border-line2 bg-ink py-1.5 pl-7 pr-2 font-mono text-[11px] text-white placeholder:text-fog/60 focus:border-cyan-dim focus:outline-none"
              />
            </div>
          }
        >
          {table ? (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[11px]">
                  <thead>
                    <tr className="border-b border-line2 font-mono text-[9px] tracking-[0.14em] text-fog">
                      <th className="py-2 pr-3">COLUMN</th>
                      <th className="py-2 pr-3 text-right">MEAN</th>
                      <th className="py-2 pr-3 text-right">STD</th>
                      <th className="py-2 pr-3 text-right">MIN</th>
                      <th className="py-2 pr-3 text-right">MEDIAN</th>
                      <th className="py-2 text-right">MAX</th>
                    </tr>
                  </thead>
                  <tbody>
                    {table.items.map((f) => (
                      <tr key={f.name} className="border-b border-line/50 hover:bg-panel2/60">
                        <td className="py-1.5 pr-3 font-mono text-cyan-200/90">{f.name}</td>
                        <td className="py-1.5 pr-3 text-right font-mono tabular-nums text-mist">{fmtNum(f.stats.mean, 2)}</td>
                        <td className="py-1.5 pr-3 text-right font-mono tabular-nums text-fog">{fmtNum(f.stats.std, 2)}</td>
                        <td className="py-1.5 pr-3 text-right font-mono tabular-nums text-fog">{fmtNum(f.stats.min, 2)}</td>
                        <td className="py-1.5 pr-3 text-right font-mono tabular-nums text-fog">{fmtNum(f.stats.median, 2)}</td>
                        <td className="py-1.5 text-right font-mono tabular-nums text-fog">{fmtNum(f.stats.max, 2)}</td>
                      </tr>
                    ))}
                    {table.items.length === 0 && (
                      <tr><td colSpan={6} className="py-6 text-center text-fog">No columns match “{search}”.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="mt-3 flex items-center justify-between font-mono text-[10px] text-fog">
                <span>PAGE {table.page} · {table.total} TOTAL</span>
                <div className="flex gap-1.5">
                  <button
                    disabled={table.page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="rounded-sm border border-line2 px-2 py-1 hover:text-mist disabled:opacity-40"
                  >◀ PREV</button>
                  <button
                    disabled={table.page * table.page_size >= table.total}
                    onClick={() => setPage((p) => p + 1)}
                    className="rounded-sm border border-line2 px-2 py-1 hover:text-mist disabled:opacity-40"
                  >NEXT ▶</button>
                </div>
              </div>
            </>
          ) : (
            <SkeletonBlock className="h-72" />
          )}
        </Panel>

        {/* KPIs + MAT */}
        <div className="space-y-5">
          <Panel title={`MODEL ${model} SUMMARY`} tag="REAL DATA">
            {summary?.available ? (
              <dl className="space-y-2 text-xs">
                <Fact label="Rows (simulation runs / events)" value={fmtInt(summary.rows)} />
                {Object.entries(summary.kpi ?? {}).slice(0, 8).map(([k, v]) => (
                  <Fact key={k} label={humanize(k)} value={fmtNum(v, 2)} />
                ))}
              </dl>
            ) : summary ? (
              <p className="text-xs text-fog">Model {model} file not found on disk.</p>
            ) : (
              <SkeletonBlock className="h-48" />
            )}
          </Panel>

          <Panel title="MAT WORKBOOK" subtitle="3000Samplesv3.mat" tag="REAL DATA">
            {mat?.available && mat.arrays ? (
              <div className="max-h-56 space-y-1.5 overflow-y-auto pr-1">
                {Object.entries(mat.arrays).slice(0, 24).map(([name, a]) => (
                  <div key={name} className="flex items-center justify-between gap-2 rounded-sm border border-line/70 bg-ink/50 px-2 py-1.5">
                    <span className="truncate font-mono text-[10px] text-cyan-200/90" title={name}>{name}</span>
                    <span className="shrink-0 font-mono text-[9.5px] text-fog">
                      {a.shape.join('×')} · {a.dtype}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-fog">{mat?.error ?? 'MAT workbook not found.'}</p>
            )}
          </Panel>
        </div>
      </div>

      {/* correlations + scatter */}
      <div className="grid gap-5 xl:grid-cols-2">
        <Panel title={`CORRELATIONS — MODEL ${model}`} subtitle="Pearson r" tag="REAL DATA">
          <ul className="space-y-1.5">
            {corr.slice(0, 10).map((p) => {
              const r = p.r ?? 0
              return (
                <li key={`${p.a}-${p.b}`} className="flex items-center gap-2 text-[11px]">
                  <span className="w-56 shrink-0 truncate text-fog" title={`${p.a} ↔ ${p.b}`}>
                    {p.a} ↔ {p.b}
                  </span>
                  <span className="relative h-1.5 flex-1 rounded-full bg-line">
                    <span
                      className={`absolute inset-y-0 rounded-full ${r >= 0 ? 'bg-cyan-400/80 left-1/2' : 'bg-amber-400/80 right-1/2'}`}
                      style={{ width: `${Math.min(100, Math.abs(r) * 100) / 2}%` }}
                    />
                    <span className="absolute inset-y-[-2px] left-1/2 w-px bg-line2" />
                  </span>
                  <span className={`w-12 text-right font-mono tabular-nums ${r >= 0 ? 'text-cyan-300' : 'text-amber-300'}`}>
                    {r >= 0 ? '+' : ''}{r.toFixed(2)}
                  </span>
                </li>
              )
            })}
          </ul>
        </Panel>

        <Panel
          title="RELATIONSHIP SAMPLE"
          subtitle={scatter ? `${scatter.x} ↔ ${scatter.y}` : undefined}
          tag="REAL DATA"
          right={
            <button
              onClick={() => setScIdx((i) => i + 1)}
              className="rounded-sm border border-line2 px-2 py-1 font-mono text-[10px] text-fog hover:text-mist"
            >NEXT PAIR ▶</button>
          }
        >
          {scatter?.available ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={binScatter(scatter.points)} margin={{ top: 8, right: 8, bottom: 16, left: 0 }}>
                  <CartesianGrid stroke="#1e2937" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="bin" tick={{ fill: '#8b98ab', fontSize: 9 }} stroke="#2a3849"
                    label={{ value: scatter.x, fill: '#8b98ab', fontSize: 10, position: 'insideBottom', offset: -4 }} />
                  <YAxis tick={{ fill: '#8b98ab', fontSize: 9 }} stroke="#2a3849" width={44}
                    label={{ value: scatter.y, fill: '#8b98ab', fontSize: 10, angle: -90, position: 'insideLeft' }} />
                  <Tooltip
                    contentStyle={{ background: '#0e141d', border: '1px solid #2a3849', fontSize: 11, borderRadius: 4 }}
                    formatter={(v, n) => [fmtNum(v as number, 1), n === 'meanY' ? scatter.y : 'count']}
                  />
                  <Bar dataKey="meanY" fill="#22d3ee" fillOpacity={0.65} radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
              <p className="mt-1 text-center font-mono text-[10px] text-fog">
                binned mean of {scatter.y} · r = {scatter.r != null ? scatter.r.toFixed(3) : '—'}
              </p>
            </div>
          ) : (
            <SkeletonBlock className="h-64" />
          )}
        </Panel>
      </div>
    </div>
  )
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-line/60 pb-1.5">
      <dt className="text-fog">{humanize(label)}</dt>
      <dd className="font-mono font-semibold tabular-nums text-white">{value}</dd>
    </div>
  )
}

function humanize(k: string) {
  return k.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

/** Turn a scatter into binned means so the explorer stays readable. */
function binScatter(points: { x: number; y: number }[], bins = 22) {
  if (points.length === 0) return []
  const xs = points.map((p) => p.x)
  const min = Math.min(...xs), max = Math.max(...xs)
  const w = (max - min) / bins || 1
  const acc = Array.from({ length: bins }, () => ({ sum: 0, n: 0, mid: 0 }))
  for (const p of points) {
    const i = Math.min(bins - 1, Math.max(0, Math.floor((p.x - min) / w)))
    acc[i].sum += p.y
    acc[i].n += 1
  }
  return acc.map((a, i) => ({
    bin: +(min + w * (i + 0.5)).toFixed(1),
    meanY: a.n ? +(a.sum / a.n).toFixed(2) : 0,
    n: a.n,
  })).filter((d) => d.n > 0)
}

export const __explorerIcons = { Table2 }
