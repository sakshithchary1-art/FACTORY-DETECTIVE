// FORGE SIGHT — initial loading screen. Short (~2 s), calm, on-theme.
// Pure React state; no reload; fades into the dashboard.

import { useEffect, useState } from 'react'
import { ForgeSightLogo } from '../brand/ForgeSightLogo'
import { LoadingLine } from './Feedback'

const STEPS = [
  'Initializing dashboard',
  'Loading manufacturing data',
  'Preparing production analysis',
  'Preparing visualization',
  'Ready',
]

export function BootScreen({ onDone, duration = 1300 }) {
  const [leaving, setLeaving] = useState(false)
  const [step, setStep] = useState(0)

  useEffect(() => {
    const per = duration / STEPS.length
    const timers = STEPS.map((_, i) => setTimeout(() => setStep(i), i * per))
    const t1 = setTimeout(() => setLeaving(true), duration - 280)
    const t2 = setTimeout(() => onDone?.(), duration)
    return () => { timers.forEach(clearTimeout); clearTimeout(t1); clearTimeout(t2) }
  }, [duration, onDone])

  return (
    <div
      className={`fixed inset-0 z-[200] flex flex-col items-center justify-center bg-[#f7f3ea] transition-opacity duration-300 ${
        leaving ? 'pointer-events-none opacity-0' : 'opacity-100'
      }`}
      aria-busy="true"
      aria-label="Forge SIGHT is starting"
    >
      <div className="flex w-72 flex-col items-center px-6 text-center">
        <ForgeSightLogo size={38} tagline />
        <div className="mt-9 w-full">
          <LoadingLine
            label={STEPS[step]}
            percent={((step + 1) / STEPS.length) * 100}
            status={step === STEPS.length - 1 ? 'success' : 'loading'}
          />
        </div>
      </div>
    </div>
  )
}
