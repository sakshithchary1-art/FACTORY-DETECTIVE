// Inspect — honest computer-vision extension slot.
//
// The dataset has NO defect images, so this page never pretends to detect
// defects. It is a real upload → preview → analysis-request workflow: if
// FORGE_VISION_URL is configured in the backend, the image is forwarded to a
// real external vision model and its verdict is shown. Without a model, the
// module reports clearly that vision is not connected.

import { useRef, useState } from 'react'
import { Camera, ImageIcon, Upload } from 'lucide-react'
import { api } from '../services/api'
import { useStore } from '../store'
import { Panel, Chip, StatusBadge, Skeleton } from '../components/ui'
import { fmtNum } from '../utils/format'

export function Inspect() {
  const { toast } = useStore()
  const fileRef = useRef(null)
  const [img, setImg] = useState(null)
  const [result, setResult] = useState(null)
  const [busy, setBusy] = useState(false)

  const onFile = (f) => {
    if (!f) return
    if (!f.type.startsWith('image/')) {
      toast('error', 'Please provide an image file (PNG/JPG).')
      return
    }
    if (f.size > 8 * 1024 * 1024) {
      toast('error', 'Image too large — 8 MB maximum.')
      return
    }
    const reader = new FileReader()
    reader.onload = () => { setImg(reader.result); setResult(null) }
    reader.readAsDataURL(f)
  }

  const analyse = async () => {
    if (!img) return
    setBusy(true)
    try {
      const r = await api.vision(img)
      setResult(r)
      if (r.connected) toast('success', 'Vision model returned a result.')
      else toast('info', 'Vision module is not connected — showing dataset capability instead.')
    } catch (e) {
      toast('error', e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-white tracking-tight flex items-center gap-2">
          <Camera size={18} className="text-neon" /> Visual Inspection
        </h2>
        <p className="text-xs text-fog">
          Optional extension slot — ForgeSite's analytics are dataset-driven, not image-driven.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.35fr_1fr]">
        <Panel>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-[12px] font-bold tracking-[0.14em] text-white">PRODUCT IMAGE</h3>
            <Chip label="NO DEFECT IMAGES IN DATASET" tone="amber" />
          </div>
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); onFile(e.dataTransfer.files?.[0]) }}
            onClick={() => fileRef.current?.click()}
            className="group flex h-80 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-line2 bg-navy-850/50 transition hover:border-neon/50"
          >
            {img ? (
              <img src={img} alt="upload preview" className="h-full w-full rounded-xl object-contain p-2" />
            ) : (
              <>
                <Upload size={30} className="text-fog transition group-hover:text-neon" />
                <p className="mt-3 text-sm font-medium text-mist">Drop an image or click to upload</p>
                <p className="mt-1 text-[11px] text-fog">PNG / JPG · max 8 MB · analysed only if a vision model is connected</p>
              </>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden"
            onChange={(e) => onFile(e.target.files?.[0])} />
          <button onClick={analyse} disabled={!img || busy}
            className="mt-4 w-full rounded-lg bg-gradient-to-r from-neon to-purple py-2.5 text-xs font-semibold text-white glow-neon disabled:opacity-40">
            {busy ? 'ANALYSING…' : 'ANALYSE IMAGE'}
          </button>
        </Panel>

        <Panel>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-[12px] font-bold tracking-[0.14em] text-white">ANALYSIS RESULT</h3>
            {result && (result.connected
              ? <Chip label="VISION MODEL" tone="cyan" />
              : <Chip label="VISION NOT CONNECTED" tone="amber" />)}
          </div>

          {busy && <div className="space-y-3"><Skeleton className="h-24" /><Skeleton className="h-16" /></div>}

          {!busy && !result && (
            <div className="flex h-80 flex-col items-center justify-center text-center">
              <ImageIcon size={28} className="text-fog/60" />
              <p className="mt-3 text-sm text-mist">No image analysed yet.</p>
              <p className="mt-1 max-w-[34ch] text-[11px] leading-relaxed text-fog">
                The supplied dataset contains simulation telemetry only — no product photographs,
                so no defect labels exist to train or evaluate a vision model. ForgeSite will not
                fabricate one.
              </p>
            </div>
          )}

          {!busy && result && !result.connected && (
            <div className="rounded-xl border border-amber/40 bg-amber/5 px-4 py-4">
              <p className="text-[13px] font-semibold text-amber">Visual inspection module can be connected to a computer-vision model.</p>
              <p className="mt-2 text-[11.5px] leading-relaxed text-fog">
                {result.message}
              </p>
              <p className="mt-3 text-[11.5px] leading-relaxed text-fog">
                To enable it, set <code className="rounded bg-navy-900 px-1 font-mono text-[10px] text-cyan">FORGE_VISION_URL</code> in
                the backend <code className="rounded bg-navy-900 px-1 font-mono text-[10px] text-cyan">.env</code> to an HTTP endpoint
                that accepts <code className="rounded bg-navy-900 px-1 font-mono text-[10px] text-cyan">{'{ image_base64 }'}</code> and
                returns a verdict JSON. ForgeSite then renders that model's real output here.
              </p>
            </div>
          )}

          {!busy && result?.connected && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[13px] text-fog">Verdict</span>
                <StatusBadge status={result.verdict?.status || 'info'} />
              </div>
              {result.verdict?.label && (
                <div className="flex items-center justify-between text-[13px]">
                  <span className="text-fog">Label</span><span className="font-semibold text-white">{result.verdict.label}</span>
                </div>
              )}
              {result.verdict?.confidence != null && (
                <div className="flex items-center justify-between text-[13px]">
                  <span className="text-fog">Confidence</span><span className="font-mono text-white">{fmtPct(result.verdict.confidence, 1)}</span>
                </div>
              )}
              {result.verdict?.detail && (
                <p className="rounded-lg border border-line bg-navy-850/60 px-3 py-2 text-[11.5px] leading-relaxed text-fog">{result.verdict.detail}</p>
              )}
              <p className="text-[10px] italic text-fog">Result produced by the connected vision model — not evaluated by ForgeSite.</p>
            </div>
          )}
        </Panel>
      </div>

      <Panel pad={false}>
        <div className="px-5 py-3 text-[11px] leading-relaxed text-fog">
          <span className="font-semibold text-mist">Why no demo vision?</span> ForgeSite's credibility rule:
          never pretend the dataset contains something it does not. The supplied files are discrete-event
          simulation telemetry (utilizations, queues, cycle times, counters) — powerful for bottleneck,
          anomaly and what-if analysis, but silent about product appearance. Everything elsewhere in the
          app is computed from that real telemetry.
        </div>
      </Panel>
    </div>
  )
}
