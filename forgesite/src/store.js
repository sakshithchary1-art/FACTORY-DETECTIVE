// Forge SIGHT global store — navigation, live activity feed, demo mode.

import { create } from 'zustand'

let toastSeq = 1
let activitySeq = 1

export const useStore = create((set, get) => ({
  page: 'overview',
  navigate: (page) => {
    set({ page, aiOpen: false })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  },

  toasts: [],
  toast: (kind, text) => {
    const id = toastSeq++
    set({ toasts: [...get().toasts, { id, kind, text }] })
    setTimeout(() => set({ toasts: get().toasts.filter((t) => t.id !== id) }), 4200)
  },
  dismissToast: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),

  // live activity — generated from actual user interactions + real backend events
  activity: [],
  logActivity: (kind, title, detail) => {
    const item = { id: activitySeq++, kind, title, detail, ts: Date.now() }
    set({ activity: [item, ...get().activity].slice(0, 12) })
  },

  // FORGE AI drawer
  aiOpen: false,
  setAiOpen: (v) => set({ aiOpen: v }),

  // demo mode
  demoStep: -1,
  demoActive: false,
  setDemo: (active, step = -1) => set({ demoActive: active, demoStep: step }),

  // selected station shared between flow + simulate
  selectedStation: null,
  setSelectedStation: (id) => set({ selectedStation: id }),
}))
