import { CheckCircle2, Info, TriangleAlert, XCircle, X } from 'lucide-react'
import { useStore } from '../store'

const META = {
  info: { icon: <Info size={14} className="text-cyan" />, border: 'border-cyan/40' },
  success: { icon: <CheckCircle2 size={14} className="text-green" />, border: 'border-green/40' },
  warn: { icon: <TriangleAlert size={14} className="text-amber" />, border: 'border-amber/40' },
  error: { icon: <XCircle size={14} className="text-red" />, border: 'border-red/40' },
}

export function Toasts() {
  const { toasts, dismissToast } = useStore()
  return (
    <div className="pointer-events-none fixed right-5 bottom-5 z-[100] flex w-80 flex-col gap-2">
      {toasts.map((t) => (
        <div key={t.id} className={`pointer-events-auto fade-up flex items-start gap-2.5 rounded-xl border bg-white px-4 py-3 shadow-[0_8px_24px_rgba(16,24,40,0.14)] ${META[t.kind].border}`}>
          <span className="mt-0.5 shrink-0">{META[t.kind].icon}</span>
          <p className="flex-1 text-xs leading-relaxed text-mist">{t.text}</p>
          <button onClick={() => dismissToast(t.id)} className="shrink-0 text-fog hover:text-ink" aria-label="Dismiss">
            <X size={13} />
          </button>
        </div>
      ))}
    </div>
  )
}
