// PAGE 2 — INSPECT: industrial visual inspection (demo vision mode).

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ArrowRight, Crosshair, ImageIcon, RefreshCw, ScanSearch, Upload, X,
} from 'lucide-react'
import { api } from '../api'
import { Badge, Button, DataTagBadge, Panel } from '../components/ui'
import { SEVERITY_META } from '../lib/ui'
import { useStore } from '../store'
import type { InspectionCase, VisionResult } from '../types'

const DEMOS: { id: string; label: string; defect: boolean }[] = [
  { id: 'surface-crack', label: 'Surface Crack', defect: true },
  { id: 'scratch', label: 'Scratch', defect: true },
  { id: 'dent', label: 'Dent', defect: true },
  { id: 'misalignment', label: 'Misalignment', defect: true },
  { id: 'normal', label: 'Normal', defect: false },
]

const DEMO_CASES: Record<string, InspectionCase> = {
  'surface-crack': {
    demoType: 'surface-crack', label: 'Surface Crack', severity: 'high',
    confidence: 94.2, location: 'Upper-right surface', station: 'PRESS3',
    batch: 'B17', defectIsDefect: true,
  },
  'scratch': {
    demoType: 'scratch', label: 'Scratch', severity: 'medium',
    confidence: 87.6, location: 'Lower-left edge', station: 'CELL1',
    batch: 'B21', defectIsDefect: true,
  },
  'dent': {
    demoType: 'dent', label: 'Dent', severity: 'medium',
    confidence: 83.1, location: 'Lower panel', station: 'FORKLIFT',
    batch: 'B09', defectIsDefect: true,
  },
  'misalignment': {
    demoType: 'misalignment', label: 'Misalignment', severity: 'low',
    confidence: 78.9, location: 'Left seam', station: 'CELL2',
    batch: 'B33', defectIsDefect: true,
  },
  'normal': {
    demoType: 'normal', label: 'No defect', severity: 'none',
    confidence: 96.8, location: '—', station: 'PRESS3',
    batch: 'B40', defectIsDefect: false,
  },
}

// deterministic pseudo-panel image (industrial enclosure face)
function PanelArt() {
  return (
    <svg viewBox="0 0 400 300" className="h-full w-full">
      <defs>
        <linearGradient id="steel" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2a3342" />
          <stop offset="0.5" stopColor="#1c2431" />
          <stop offset="1" stopColor="#232c3b" />
        </linearGradient>
        <linearGradient id="sheen" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="rgba(255,255,255,0.05)" />
          <stop offset="0.5" stopColor="rgba(255,255,255,0.01)" />
          <stop offset="1" stopColor="rgba(255,255,255,0.04)" />
        </linearGradient>
      </defs>
      <rect x="42" y="28" width="316" height="244" rx="10" fill="url(#steel)" stroke="#3a4658" strokeWidth="2" />
      <rect x="42" y="28" width="316" height="244" rx="10" fill="url(#sheen)" />
      {[54, 76, 98].map((y) => (
        <g key={y}>
          <rect x="64" y={y} width="120" height="9" rx="2" fill="#141b26" stroke="#333f50" strokeWidth="1" />
          <rect x="216" y={y} width="120" height="9" rx="2" fill="#141b26" stroke="#333f50" strokeWidth="1" />
        </g>
      ))}
      <rect x="64" y="130" width="272" height="70" rx="6" fill="#10161f" stroke="#333f50" />
      <rect x="64" y="216" width="60" height="34" rx="4" fill="#141b26" stroke="#3f4c60" />
      <circle cx="330" cy="233" r="12" fill="#141b26" stroke="#3f4c60" />
      <circle cx="330" cy="233" r="4" fill="#0e7490" opacity="0.7" />
      <text x="64" y="124" fontFamily="monospace" fontSize="9" fill="#5a6b80" letterSpacing="3">
        UNIT B17 · PANEL ASSEMBLY · STATION FEED
      </text>
    </svg>
  )
}

export function Inspect() {
  const { navigate, inspection, setInspection, toast, demoActive } = useStore()
  const [result, setResult] = useState<VisionResult | null>(null)
  const [scanning, setScanning] = useState(false)
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const runDemoInspection = useCallback(async (demoType: string) => {
    setScanning(true)
    setResult(null)
    setUploadedUrl(null)
    try {
      // brief animated scan for the demo experience
      await new Promise((r) => setTimeout(r, 1400))
      const res = await api.visionDemo(demoType)
      setResult(res)
      const c = DEMO_CASES[demoType]
      if (c) setInspection(c)
      if (res.severity !== 'none') {
        toast('success', `${res.label} detected — confidence ${res.confidence}%`)
      } else {
        toast('info', 'No defect detected on this panel.')
      }
    } catch (e) {
      toast('error', e instanceof Error ? e.message : 'Inspection failed')
    } finally {
      setScanning(false)
    }
  }, [setInspection, toast])

  // auto-run the demo case when entering via RUN DEMO
  useEffect(() => {
    if (demoActive) void runDemoInspection(inspection.demoType || 'surface-crack')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demoActive])

  const onFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast('error', 'Invalid file — please upload an image (PNG/JPG).')
      return
    }
    if (file.size > 8 * 1024 * 1024) {
      toast('error', 'Image too large — 8 MB maximum.')
      return
    }
    setScanning(true)
    setResult(null)
    const url = URL.createObjectURL(file)
    setUploadedUrl(url)
    try {
      const res = await api.visionUpload(file)
      setResult(res)
      toast('warn', 'Image received — no trained vision model attached in this prototype.')
    } catch (e) {
      toast('error', e instanceof Error ? e.message : 'Upload failed')
      setUploadedUrl(null)
    } finally {
      setScanning(false)
    }
  }

  const meta = result ? SEVERITY_META[result.severity] ?? SEVERITY_META.unknown : null

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-mono text-xl font-bold tracking-[0.2em] text-white">VISUAL INSPECTION</h1>
          <p className="mt-1 text-sm text-fog">
            Inspect the product, then trace the defect to its process story.
          </p>
        </div>
        <DataTagBadge tag={result ? (result.demo ? 'DEMO DATA' : 'EVALUATION PENDING') : 'DEMO DATA'} />
      </header>

      <div className="grid gap-5 lg:grid-cols-5">
        {/* viewport */}
        <Panel
          title="INSPECTION VIEWPORT"
          subtitle="Demo vision mode — synthetic product imagery"
          className="lg:col-span-3"
          right={<Badge tone="cyan"><ScanSearch size={10} /> CAMERA 04 · QUALITY GATE</Badge>}
        >
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault(); setDragOver(false)
              const f = e.dataTransfer.files?.[0]
              if (f) void onFile(f)
            }}
            className={`relative aspect-[4/3] w-full overflow-hidden rounded-md border bg-ink transition-colors ${
              dragOver ? 'border-cyan-400' : 'border-line'
            }`}
          >
            {uploadedUrl ? (
              <img src={uploadedUrl} alt="Uploaded inspection frame" className="h-full w-full object-cover" />
            ) : (
              <div className="h-full w-full p-2"><PanelArt /></div>
            )}

            {/* scanline */}
            {scanning && <div className="scanline pointer-events-none absolute inset-x-0 top-0 h-[14%]" />}

            {/* bounding box */}
            {result?.box && !scanning && (
              <div
                className="rise-in absolute rounded-sm border-2 border-red-500 shadow-[0_0_18px_rgba(239,68,68,0.45)]"
                style={{
                  left: `${result.box.x}%`, top: `${result.box.y}%`,
                  width: `${result.box.w}%`, height: `${result.box.h}%`,
                }}
              >
                <span className="absolute -top-5 left-0 whitespace-nowrap rounded-sm bg-red-500/90 px-1.5 py-0.5 font-mono text-[9px] font-bold tracking-[0.1em] text-white">
                  {result.label.toUpperCase()} · {result.confidence}%
                </span>
              </div>
            )}

            {/* corner brackets */}
            <div className="pointer-events-none absolute inset-3">
              {['top-0 left-0 border-t-2 border-l-2', 'top-0 right-0 border-t-2 border-r-2',
                'bottom-0 left-0 border-b-2 border-l-2', 'bottom-0 right-0 border-b-2 border-r-2'].map((c) => (
                <span key={c} className={`absolute h-5 w-5 border-cyan-500/40 ${c}`} />
              ))}
            </div>

            {scanning && (
              <div className="absolute inset-x-0 bottom-0 bg-ink/80 px-3 py-2 font-mono text-[10px] tracking-[0.18em] text-cyan-300">
                SCANNING SURFACE · ANALYZING FEATURES…
              </div>
            )}

            {!result && !scanning && (
              <div className="absolute inset-0 grid place-items-center bg-void/55 p-6 text-center backdrop-blur-[2px]">
                <div>
                  <Crosshair size={26} className="mx-auto text-fog" />
                  <p className="mt-3 font-mono text-[11px] tracking-[0.16em] text-mist">
                    SELECT A DEMO INSPECTION OR DROP AN IMAGE
                  </p>
                  <p className="mt-1 text-[11px] text-fog">PNG/JPG up to 8 MB</p>
                </div>
              </div>
            )}
          </div>

          {/* demo selector */}
          <div className="mt-4 flex flex-wrap gap-2">
            {DEMOS.map((d) => (
              <button
                key={d.id}
                onClick={() => void runDemoInspection(d.id)}
                disabled={scanning}
                className={`rounded-md border px-3 py-1.5 font-mono text-[11px] tracking-[0.1em] transition-all disabled:opacity-40 ${
                  result && inspection.demoType === d.id && !uploadedUrl
                    ? 'border-cyan-500/60 bg-cyan-500/15 text-cyan-200'
                    : 'border-line2 bg-panel2 text-fog hover:border-cyan-dim hover:text-mist'
                }`}
              >
                {d.label}
              </button>
            ))}
            <button
              onClick={() => fileRef.current?.click()}
              disabled={scanning}
              className="flex items-center gap-1.5 rounded-md border border-dashed border-line2 px-3 py-1.5 font-mono text-[11px] tracking-[0.1em] text-fog transition-colors hover:border-cyan-dim hover:text-mist disabled:opacity-40"
            >
              <Upload size={11} /> UPLOAD IMAGE
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void onFile(f)
                e.currentTarget.value = ''
              }}
            />
          </div>
        </Panel>

        {/* verdict */}
        <div className="space-y-5 lg:col-span-2">
          <Panel title="INSPECTION RESULT" right={result && <DataTagBadge tag={result.demo ? 'DEMO DATA' : 'EVALUATION PENDING'} />}>
            {scanning ? (
              <div className="space-y-3">
                <div className="skeleton h-6 w-2/3 rounded" />
                <div className="skeleton h-16 rounded" />
                <div className="skeleton h-10 rounded" />
              </div>
            ) : result ? (
              <div className="rise-in">
                {result.severity === 'none' ? (
                  <p className="font-mono text-lg font-bold tracking-[0.14em] text-emerald-400">
                    ✓ NO DEFECT DETECTED
                  </p>
                ) : result.uploaded ? (
                  <p className="font-mono text-lg font-bold tracking-[0.14em] text-amber-300">
                    ANALYSIS PENDING
                  </p>
                ) : (
                  <p className="font-mono text-lg font-bold tracking-[0.14em] text-red-400">
                    ⚠ DEFECT DETECTED
                  </p>
                )}
                <p className="mt-1 text-2xl font-semibold text-white">{result.label}</p>

                <dl className="mt-4 space-y-2.5 text-sm">
                  <Row label="Confidence" value={result.confidence != null ? `${result.confidence}%` : '—'} />
                  <Row label="Severity" value={meta?.label ?? '—'} tone={meta?.text} />
                  <Row label="Location" value={result.location ?? '—'} />
                  <Row label="Batch" value={result.batch} />
                </dl>

                {result.note && (
                  <p className="mt-4 rounded-sm border border-line bg-ink/60 px-3 py-2 text-[11px] leading-relaxed text-fog">
                    {result.note}
                  </p>
                )}

                {result.demo && result.severity !== 'none' && (
                  <Button
                    variant="primary"
                    className="mt-5 w-full"
                    onClick={() => navigate('investigate')}
                  >
                    INVESTIGATE ROOT CAUSE <ArrowRight size={12} />
                  </Button>
                )}
              </div>
            ) : (
              <p className="py-6 text-center text-xs text-fog">
                Run a demo inspection to see the verdict here.
              </p>
            )}
          </Panel>

          <Panel title="HOW THIS WORKS" tag="EVALUATION PENDING">
            <ul className="space-y-2 text-[11.5px] leading-relaxed text-fog">
              <li className="flex gap-2"><ImageIcon size={13} className="mt-0.5 shrink-0 text-cyan-300" />
                The supplied dataset is simulation data (numeric), so vision here is a
                clearly-labelled prototype mode.</li>
              <li className="flex gap-2"><RefreshCw size={13} className="mt-0.5 shrink-0 text-cyan-300" />
                Demo inspections follow the FD-017 story: defect → batch → station.</li>
              <li className="flex gap-2"><Upload size={13} className="mt-0.5 shrink-0 text-cyan-300" />
                Uploaded images are accepted for the flow; no trained model claims are made
                (“Evaluation pending”).</li>
            </ul>
          </Panel>
        </div>
      </div>
    </div>
  )
}

function Row({ label, value, tone = 'text-white' }: { label: string; value: string; tone?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-line/60 pb-2">
      <dt className="text-xs text-fog">{label}</dt>
      <dd className={`font-mono text-sm font-semibold ${tone}`}>{value}</dd>
    </div>
  )
}

// silence unused import warnings for icons kept for future use
export const __inspectIcons = { X }
