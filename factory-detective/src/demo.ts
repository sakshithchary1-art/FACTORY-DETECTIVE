// One-click demo investigation — walks judges through the full story:
// Inspect → Investigate → Production → Impact → Simulate → Decide.
// Uses dataset-driven data wherever the backend provides it; the case file
// (defect → batch → station) is the clearly-labelled demo layer.

import { api } from './api'
import { DEMO_CASE_ID, useStore } from './store'

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Prefetch analytics so each step lands instantly. */
async function prefetch() {
  const s = useStore.getState()
  try {
    const [inv, bk, sim, m1, m3] = await Promise.all([
      api.investigation(DEMO_CASE_ID),
      api.bottlenecks().catch(() => null),
      api.simulate({ station: 'PRESS3', cycle_adj_pct: -10, extra_capacity: false, queue_reduction_pct: 0, case_id: DEMO_CASE_ID })
        .catch(() => null),
      api.modelSummary(1).catch(() => null),
      api.modelSummary(3).catch(() => null),
    ])
    useStore.setState({ caseId: DEMO_CASE_ID })
    return { inv, bk, sim, m1, m3 }
  } catch (e) {
    s.toast('error', e instanceof Error ? e.message : 'Backend unreachable — start the API server (uvicorn main:app)')
    throw e
  }
}

export async function runDemo(): Promise<void> {
  const store = useStore.getState()
  store.setDemo(true, -1)
  store.toast('info', 'Demo investigation FD-017 starting — Surface Crack on batch B17.')

  // 0 — kick off data prefetch while we walk
  const dataP = prefetch().catch(() => null)
  await sleep(400)

  // 1 — INSPECT: surface crack detected (time to narrate the finding)
  store.setDemo(true, 0)
  store.navigate('inspect')
  await sleep(9000)

  // 2 — INVESTIGATE: root-cause signals + correlations
  store.setDemo(true, 1)
  store.navigate('investigate')
  await sleep(10000)

  // 3 — PRODUCTION: flow + bottleneck
  store.setDemo(true, 2)
  store.navigate('production')
  await sleep(10000)

  // 4 — IMPACT: cost model
  store.setDemo(true, 3)
  store.navigate('impact')
  await sleep(10000)

  // 5 — SIMULATE: what-if (queue a gentle cycle-time reduction)
  store.setDemo(true, 4)
  store.navigate('simulator')
  await sleep(5000)
  window.dispatchEvent(new CustomEvent('fd:demo-simulate', { detail: { cycle_adj_pct: -10 } }))
  await sleep(7000)

  // 6 — DECIDE: AI decision brief (allow the page to mount before triggering)
  store.setDemo(true, 5)
  store.navigate('brief')
  await sleep(1200)
  window.dispatchEvent(new CustomEvent('fd:demo-brief'))
  await sleep(4000)

  const data = await dataP
  await sleep(1200)
  store.toast(
    'success',
    'Investigation complete — from defect → cause → constraint → cost → decision.',
  )
  store.setDemo(false, -1)
  void data
}
