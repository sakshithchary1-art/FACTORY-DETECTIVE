// Factory Detective — global investigation state (zustand).
// The store carries the demo case through every page so the whole app tells
// one continuous story: defect → cause → bottleneck → cost → decision.

import { create } from 'zustand'
import type { CostImpact, InspectionCase, PageId, Simulation, Toast } from './types'

export const DEMO_CASE_ID = 'FD-017'

export const DEFAULT_INSPECTION: InspectionCase = {
  demoType: 'surface-crack',
  label: 'Surface Crack',
  severity: 'high',
  confidence: 94.2,
  location: 'Upper-right surface',
  station: 'PRESS3',
  batch: 'B17',
  defectIsDefect: true,
}

interface Store {
  page: PageId
  navigate: (p: PageId) => void

  caseId: string
  inspection: InspectionCase
  setInspection: (c: InspectionCase) => void

  simulation: Simulation | null
  setSimulation: (s: Simulation | null) => void
  simRan: boolean
  setSimRan: (v: boolean) => void

  costs: CostImpact | null
  setCosts: (c: CostImpact | null) => void

  // demo mode
  demoActive: boolean
  demoStep: number // 0..5 (inspect..decide), -1 when idle
  setDemo: (active: boolean, step?: number) => void

  toasts: Toast[]
  toast: (kind: Toast['kind'], text: string) => void
  dismissToast: (id: number) => void

  backendOnline: boolean | null
  setBackendOnline: (v: boolean | null) => void
}

let toastSeq = 1

export const useStore = create<Store>((set, get) => ({
  page: 'overview',
  navigate: (p) => {
    set({ page: p })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  },

  caseId: DEMO_CASE_ID,
  inspection: DEFAULT_INSPECTION,
  setInspection: (c) => set({ inspection: c }),

  simulation: null,
  setSimulation: (s) => set({ simulation: s }),
  simRan: false,
  setSimRan: (v) => set({ simRan: v }),

  costs: null,
  setCosts: (c) => set({ costs: c }),

  demoActive: false,
  demoStep: -1,
  setDemo: (active, step = -1) => set({ demoActive: active, demoStep: step }),

  toasts: [],
  toast: (kind, text) => {
    const id = toastSeq++
    set({ toasts: [...get().toasts, { id, kind, text }] })
    window.setTimeout(() => {
      set({ toasts: get().toasts.filter((t) => t.id !== id) })
    }, 4200)
  },
  dismissToast: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),

  backendOnline: null,
  setBackendOnline: (v) => set({ backendOnline: v }),
}))
