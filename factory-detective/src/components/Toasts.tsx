import { CheckCircle2, Info, TriangleAlert, XCircle, X } from 'lucide-react'
import { useStore } from '../store'

const ICONS = {
  info: <Info size={14} className="text-cyan-300" />,
  success: <CheckCircle2 size={14} className="text-emerald-400" />,
  warn: <TriangleAlert size={14} className="text-amber-400" />,
  error: <XCircle size={14} className="text-red-400" />,
}

const BORDERS = {
  info: 'border-cyan-500/40',
  success: 'border-emerald-500/40',
  warn: 'border-amber-500/40',
  error: 'border-red-500/40',
}

export function Toasts() {
  const { toasts, dismissToast } = useStore()
  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-[100] flex w-80 flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          className={`pointer-events-auto rise-in flex items-start gap-2.5 rounded-md border bg-panel/95 px-3.5 py-3 shadow-2xl backdrop-blur ${BORDERS[t.kind]}`}
        >
          <span className="mt-0.5 shrink-0">{ICONS[t.kind]}</span>
          <p className="flex-1 text-xs leading-relaxed text-mist">{t.text}</p>
          <button
            onClick={() => dismissToast(t.id)}
            className="shrink-0 text-fog transition-colors hover:text-white"
            aria-label="Dismiss"
          >
            <X size={13} />
          </button>
        </div>
      ))}
    </div>
  )
}
