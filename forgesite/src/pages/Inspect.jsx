// Product Inspection — REAL image dataset integration.
//
// Browse and analyze the supplied image dataset (12,000 PNGs, 5 actual
// classes). Ground truth (dataset label) and prediction (vision pipeline) are
// always shown separately. Image→production linkage is attempted honestly:
// this dataset carries no batch/SKU/station ids, so the UI says so and offers
// manual association with the live manufacturing analytics instead.

import { useEffect, useRef, useState } from 'react'
import {
  Upload, Search, RefreshCw, ChevronLeft, ChevronRight,
  ArrowRight, Link2Off, Link2, FlaskConical, Eye,
} from 'lucide-react'
import { api } from '../services/api'
import { useStore } from '../store'
import { Panel, Chip, Skeleton, SectionTitle, EmptyState } from '../components/ui'
import { CircularProgress, LoadingLine, Term } from '../components/Feedback'
import { fmtInt, fmtPct } from '../utils/format'

const splitTone = { train: 'cyan', val: 'purple', test: 'neon' }

export function Inspect() {
  const { toast, logActivity, navigate } = useStore()
  const fileRef = useRef(null)

  const [summary, setSummary] = useState(null)
  const [modelStatus, setModelStatus] = useState(null)
  const [classes, setClasses] = useState([])
  const [label, setLabel] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [list, setList] = useState(null)
  const [selected, setSelected] = useState(null)   // image record
  const [detail, setDetail] = useState(null)       // prediction result
  const [analyzing, setAnalyzing] = useState(false)
  const [ctx, setCtx] = useState(null)             // production context

  // initial load: dataset stats + model status + first page
  useEffect(() => {
    Promise.all([api.imageSummary(), api.visionModelStatus(), api.images({ page: 1, page_size: 24 })])
      .then(([s, m, l]) => { setSummary(s); setModelStatus(m); setList(l); setClasses(s.classes || []) })
      .catch((e) => toast('error', e.message))
  }, [toast])

  // refetch list on filter change
  useEffect(() => {
    const t = setTimeout(() => {
      api.images({ label, search, page, page_size: 24 })
        .then(setList)
        .catch((e) => toast('error', e.message))
    }, 200)
    return () => clearTimeout(t)
  }, [label, search, page, toast])

  const select = (img) => {
    setSelected(img)
    setDetail(null)
    setCtx(null)
    setAnalyzing(true)
    api.imagePrediction(img.id)
      .then((r) => {
        setDetail(r)
        logActivity('analysis', 'Product image analyzed', `${img.filename} · ${r.prediction}`)
        return api.imageProductionContext(img.id)
      })
      .then(setCtx)
      .catch((e) => toast('error', e.message))
      .finally(() => setAnalyzing(false))
  }

  const analyseUpload = async (f) => {
    if (!f) return
    if (!f.type.startsWith('image/')) { toast('error', 'Please provide an image file (PNG/JPG).'); return }
    if (f.size > 8 * 1024 * 1024) { toast('error', 'Image too large — 8 MB maximum.'); return }
    const reader = new FileReader()
    reader.onload = async () => {
      setAnalyzing(true); setDetail(null); setCtx(null)
      setSelected({ id: null, filename: f.name, label: null, width: '—', height: '—', uploadUrl: reader.result })
      try {
        const r = await api.imageAnalyze(reader.result)
        setDetail(r)
        logActivity('analysis', 'Uploaded image analyzed', `${f.name} · ${r.prediction}`)
      } catch (e) { toast('error', e.message) } finally { setAnalyzing(false) }
    }
    reader.readAsDataURL(f)
  }

  const isUpload = selected && !selected.id
  const gt = detail?.ground_truth
  const conf = (detail?.confidence ?? 0) * 100

  // Demo mode: analyze a REAL dataset image (crack class, first record).
  useEffect(() => {
    const h = async () => {
      try {
        const l = await api.images({ label: 'crack', page: 1, page_size: 1 })
        if (l.images?.length) select(l.images[0])
      } catch { /* demo continues */ }
    }
    window.addEventListener('fs:demo-run-inspection', h)
    return () => window.removeEventListener('fs:demo-run-inspection', h)
  }, [])

  return (
    <div className="space-y-6">
      <SectionTitle
        title="Product Inspection"
        note="Browse the supplied image dataset, analyze a product image, then follow it into production analytics"
        right={
          <>
            {modelStatus && (
              <Chip label={modelStatus.label} tone={modelStatus.mode === 'trained' ? 'green' : 'amber'} />
            )}
            <Chip label={`${fmtInt(summary?.total_images)} IMAGES`} tone="cyan" />
          </>
        }
      />

      {summary && (
        <div className="glass flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 text-[11px] text-fog">
          <span>Images: <span className="font-medium text-mist tnum">{fmtInt(summary.total_images)}</span></span>
          <span>Classes: <span className="font-medium text-mist tnum">{summary.n_classes}</span></span>
          {summary.classes.map((c) => (
            <span key={c} className="tnum hidden md:inline">{c}: <span className="font-medium text-mist">{fmtInt(summary.class_distribution[c])}</span></span>
          ))}
          <span className="hidden lg:inline">Size: <span className="font-medium text-mist">{Object.keys(summary.dimensions)[0]}</span></span>
          <span className="hidden lg:inline">Annotations: <span className="font-medium text-mist">{summary.annotations?.available ? 'Available' : 'Not available'}</span></span>
          {modelStatus?.metrics && (
            <span className="ml-auto hidden xl:inline">
              Measured model accuracy: <span className="font-medium text-mist tnum">{fmtPct(modelStatus.metrics.accuracy * 100, 1)}</span>
              <Term tech={`Held-out evaluation on ${modelStatus.metrics.n_test} real dataset images — macro F1 ${modelStatus.metrics.f1_macro}. A lightweight feature-based classifier, reported exactly as measured.`} className="ml-1" />
            </span>
          )}
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[1.1fr_1fr]">
        {/* ---------------- dataset browser ---------------- */}
        <Panel title="Image Dataset" right={<Chip label="REAL DATA" tone="cyan" />} pad={false}>
          <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-2.5">
            <div className="relative min-w-[150px] flex-1">
              <Search size={12} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-fog" />
              <input
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1) }}
                placeholder="Search filenames…"
                className="w-full rounded-md border border-line2 bg-white py-1.5 pl-7 pr-2 text-[12px] text-ink placeholder:text-fog/60 focus:border-neon/50 focus:outline-none"
              />
            </div>
            <select
              value={label}
              onChange={(e) => { setLabel(e.target.value); setPage(1) }}
              className="rounded-md border border-line2 bg-white px-2 py-1.5 text-[12px] text-ink focus:border-neon/50 focus:outline-none"
            >
              <option value="">All classes</option>
              {classes.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {!list ? (
            <div className="grid grid-cols-4 gap-2 p-4 sm:grid-cols-6">
              {Array.from({ length: 12 }).map((_, i) => <Skeleton key={i} className="aspect-square" />)}
            </div>
          ) : list.total === 0 ? (
            <div className="p-4"><EmptyState title="No images match the current filters." /></div>
          ) : (
            <>
              <div className="grid grid-cols-4 gap-2 p-4 sm:grid-cols-6">
                {list.images.map((img) => {
                  const active = selected?.id === img.id
                  return (
                    <button
                      key={img.id}
                      onClick={() => select(img)}
                      className={`group overflow-hidden rounded-md border transition-colors ${active ? 'border-neon ring-1 ring-neon/40' : 'border-line hover:border-line2'}`}
                      title={`${img.filename} · ${img.label ?? 'unlabeled'}`}
                    >
                      <img
                        src={api.imageThumbnailUrl(img.id)}
                        alt={img.filename}
                        loading="lazy"
                        className="aspect-square w-full bg-navy-800 object-cover"
                      />
                      <span className="block truncate px-1 py-1 text-[8.5px] text-fog">{img.filename}</span>
                    </button>
                  )
                })}
              </div>
              <div className="flex items-center justify-between border-t border-line px-4 py-2 text-[11px] text-fog">
                <span className="tnum">{fmtInt((page - 1) * list.page_size + 1)}–{fmtInt(Math.min(page * list.page_size, list.total))} of {fmtInt(list.total)}</span>
                <div className="flex items-center gap-1">
                  <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}
                    className="rounded border border-line2 p-1 disabled:opacity-40"><ChevronLeft size={12} /></button>
                  <span className="tnum px-1">{page} / {list.pages}</span>
                  <button onClick={() => setPage((p) => Math.min(list.pages, p + 1))} disabled={page >= list.pages}
                    className="rounded border border-line2 p-1 disabled:opacity-40"><ChevronRight size={12} /></button>
                </div>
              </div>
            </>
          )}
        </Panel>

        {/* ---------------- inspection view ---------------- */}
        <Panel title="Inspection" right={detail && <Chip label={detail.model_status} tone={detail.model_type === 'trained' ? 'green' : 'amber'} />}>
          {!selected && (
            <div className="flex h-80 flex-col items-center justify-center px-6 text-center">
              <Eye size={22} className="text-fog/50" />
              <p className="mt-2.5 text-[13px] text-mist">Select a dataset image, or upload your own.</p>
              <button onClick={() => fileRef.current?.click()}
                className="btn-secondary mt-3 flex items-center gap-1.5 px-3 py-1.5 text-[11.5px] font-semibold">
                <Upload size={12} /> UPLOAD IMAGE
              </button>
            </div>
          )}

          {selected && (
            <div className="grid gap-4 sm:grid-cols-[170px_1fr]">
              <img
                src={selected.uploadUrl || api.imageFileUrl(selected.id)}
                alt={selected.filename}
                className="h-[170px] w-[170px] rounded-md border border-line bg-navy-800 object-contain"
              />
              <div className="min-w-0">
                <p className="truncate text-[13px] font-semibold text-ink" title={selected.filename}>{selected.filename}</p>
                <dl className="mt-2 space-y-1 text-[11.5px]">
                  <div className="flex justify-between gap-3">
                    <dt className="text-fog">Ground truth</dt>
                    <dd>{gt
                      ? <span className="font-semibold text-ink">{gt}</span>
                      : <span className="text-fog italic">{selected.id ? 'Not available (unlabeled)' : 'Not available for uploads'}</span>}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-fog">Split</dt>
                    <dd>{selected.split ? <Chip label={selected.split.toUpperCase()} tone={splitTone[selected.split] || 'fog'} /> : <span className="text-fog">—</span>}</dd>
                  </div>
                  {selected.width !== '—' && (
                    <div className="flex justify-between gap-3">
                      <dt className="text-fog">Dimensions</dt>
                      <dd className="tnum text-mist">{selected.width}×{selected.height}</dd>
                    </div>
                  )}
                </dl>
              </div>
            </div>
          )}

          {analyzing && <LoadingLine label="Analyzing image" className="mt-4" />}

          {detail && !analyzing && (
            <div className="mt-4 border-t border-line pt-3">
              <div className="flex items-center gap-4">
                <CircularProgress
                  value={conf} size={78}
                  status={conf >= 75 ? 'healthy' : conf >= 55 ? 'normal' : conf >= 35 ? 'warning' : 'critical'}
                  label="Confidence"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-semibold tracking-[0.08em] text-fog uppercase">Predicted</p>
                  <p className="text-[17px] font-semibold capitalize text-ink">{detail.prediction}</p>
                  <p className="mt-1 text-[10.5px] leading-relaxed text-fog">
                    {detail.model_type === 'trained'
                      ? 'Real model prediction — lightweight classifier trained on this dataset.'
                      : 'Prototype vision analysis — deterministic features, not a validated classifier.'}
                  </p>
                </div>
              </div>
              {detail.top_predictions?.length > 1 && (
                <ul className="mt-3 space-y-1.5">
                  {detail.top_predictions.map((t) => (
                    <li key={t.label} className="flex items-center gap-2 text-[11px]">
                      <span className="w-16 shrink-0 capitalize text-fog">{t.label}</span>
                      <div className="h-[3px] flex-1 overflow-hidden rounded-full bg-[#E8E2D6]">
                        <div className="h-full rounded-full bg-neon/70" style={{ width: `${t.p * 100}%` }} />
                      </div>
                      <span className="tnum w-10 shrink-0 text-right font-mono text-fog">{fmtPct(t.p * 100, 1)}</span>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-3 rounded-md bg-navy-850 px-2.5 py-1.5 text-[10px] leading-relaxed text-fog">
                Localization data unavailable — the dataset contains no bounding-box or mask annotations,
                so none are shown.
              </p>
            </div>
          )}

          <input ref={fileRef} type="file" accept="image/*" className="hidden"
            onChange={(e) => analyseUpload(e.target.files?.[0])} />
        </Panel>
      </div>

      {/* ---------------- production context (honest linkage) ---------------- */}
      {selected && ctx && (
        <Panel
          title="Production Context"
          right={ctx.linked ? <Chip label="LINKED" tone="green" /> : <Chip label="MANUAL ASSOCIATION" tone="amber" />}
        >
          {!ctx.linked ? (
            <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
              <div className="flex flex-col justify-center border-l-2 border-amber/60 bg-amber/[0.04] px-4 py-3">
                <p className="flex items-center gap-2 text-[12.5px] font-semibold text-amber">
                  <Link2Off size={14} /> Image-to-production linkage unavailable for this sample.
                </p>
                <p className="mt-1.5 text-[11px] leading-relaxed text-fog">{ctx.reason}</p>
                <p className="mt-1.5 text-[11px] leading-relaxed text-fog">
                  Investigate by associating this finding with a station manually — the analytics
                  alongside are live manufacturing data.
                </p>
              </div>
              <ProductionSnapshot snapshot={ctx.production_snapshot} onOpen={(id) => { useStore.getState().setSelectedStation(id); navigate('flow') }} />
            </div>
          ) : (
            <ProductionSnapshot snapshot={ctx.production_snapshot} linked onOpen={(id) => { useStore.getState().setSelectedStation(id); navigate('flow') }} />
          )}
        </Panel>
      )}

      {selected && (
        <div className="flex flex-wrap justify-end gap-2">
          <button onClick={() => fileRef.current?.click()}
            className="btn-secondary flex items-center gap-1.5 px-3 py-1.5 text-[11.5px] font-semibold">
            <Upload size={12} /> UPLOAD IMAGE
          </button>
          <button
            onClick={() => {
              const station = ctx?.production_snapshot?.top_constraints?.[0]?.id
              if (station) useStore.getState().setSelectedStation(station)
              logActivity('analysis', 'Inspection routed to investigation', selected.filename)
              navigate('investigate')
            }}
            className="btn-primary flex items-center gap-1.5 px-3 py-1.5 text-[11.5px] font-semibold"
          >
            <Link2 size={12} /> INVESTIGATE IN PRODUCTION <ArrowRight size={11} />
          </button>
        </div>
      )}
    </div>
  )
}

function ProductionSnapshot({ snapshot, linked = false, onOpen }) {
  if (!snapshot) return <Skeleton className="h-28" />
  return (
    <div>
      <div className="mb-2 flex items-center gap-2 text-[11px] text-fog">
        {linked ? <Link2 size={12} className="text-green" /> : null}
        <span>Live manufacturing snapshot — <Term tech="Detailed Factory Data (Model 3), 605,620 simulation events">Detailed Factory Data</Term></span>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MiniStat label="Mean machine usage" value={snapshot.machine_usage_mean != null ? fmtPct(snapshot.machine_usage_mean, 1) : '—'} />
        {snapshot.top_constraints?.slice(0, 3).map((s, i) => (
          <button key={s.id} onClick={() => onOpen(s.id)}
            className="glass p-2.5 text-left transition-colors hover:border-line2">
            <p className="text-[9.5px] font-semibold tracking-[0.07em] text-fog uppercase">Constraint #{i + 1}</p>
            <p className="mt-0.5 truncate text-[12.5px] font-semibold text-ink">{s.name}</p>
            <p className="tnum text-[10.5px] text-fog">risk {s.constraint_risk}/100 · usage {fmtPct(s.utilization, 0)}</p>
          </button>
        ))}
      </div>
      <p className="mt-2.5 flex items-center gap-1 text-[10.5px] text-fog">
        <FlaskConical size={11} /> Continue with a What-If Test on the associated station — outputs labelled PROJECTED.
      </p>
    </div>
  )
}

function MiniStat({ label, value }) {
  return (
    <div className="glass p-2.5">
      <p className="text-[9.5px] font-semibold tracking-[0.07em] text-fog uppercase">{label}</p>
      <p className="tnum mt-0.5 text-[16px] font-semibold text-ink">{value}</p>
    </div>
  )
}
