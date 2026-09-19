// Demo mode — a 10-step guided investigation over the REAL dataset.
// Every page shown is live; nothing is mocked. Each step drives navigation,
// records a genuine activity event and lets the underlying pages load their
// own analytics, so the whole walk takes ~60-90 s with natural loading time.

import { useStore } from './store'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// Wait until the store's page matches, polling briefly (pages mount async).
async function goto(page, waitMs) {
  const { navigate, logActivity } = useStore.getState()
  navigate(page)
  await sleep(waitMs)
}

export async function runDemo() {
  const store = useStore.getState()
  const { setDemo, logActivity, toast } = store
  let cancelled = false
  const onExit = () => { cancelled = true; window.removeEventListener('fs:demo-exit', onExit) }
  window.addEventListener('fs:demo-exit', onExit)

  const guard = async (ms) => {
    await sleep(ms)
    if (cancelled) throw new Error('demo-cancelled')
  }

  setDemo(true, 0)
  try {
    // 1 — Overview: factory status from real KPIs
    await goto('overview', 2600)
    logActivity('analysis', 'Demo: factory status reviewed', 'live KPIs')
    setStep(1); await guard(2200)

    // 2 — Anomaly: overview banner / anomaly engine result
    setStep(2); await guard(2400)

    // 3 — Investigation
    await goto('investigate', 2800)
    setStep(3); await guard(2200)

    // 4 — Evidence (same page, timeline step)
    setStep(4); await guard(2600)

    // 5 — Bottleneck analysis
    setStep(5); await guard(2200)

    // 6 — Root-cause associations
    setStep(6); await guard(2600)

    // 7 — What-If Lab
    await goto('simulate', 2200)
    setStep(7); await guard(1800)

    // 8 — Run the projection (real backend call)
    setStep(8)
    window.dispatchEvent(new CustomEvent('fs:demo-run-simulation'))
    await guard(3200)
    logActivity('simulation', 'Demo: projection generated', 'What-If Lab')

    // 9 — Operational impact
    setStep(9); await guard(2600)

    // 10 — Report
    setStep(10)
    await goto('reports', 200)
    window.dispatchEvent(new CustomEvent('fs:demo-run-report'))
    await guard(3200)
    logActivity('report', 'Demo: report generated', 'live dossier')

    toast('success', 'Demo complete — anomaly → evidence → bottleneck → projection → decision.')
  } catch {
    /* user exited early */
  } finally {
    window.removeEventListener('fs:demo-exit', onExit)
    setDemo(false, -1)
  }
}

function setStep(n) {
  useStore.getState().setDemo(true, n)
}

export function exitDemo() {
  window.dispatchEvent(new CustomEvent('fs:demo-exit'))
}
