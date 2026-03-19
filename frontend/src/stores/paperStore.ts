import { create } from 'zustand'
import type { Paper, PaperListItem } from '@/types'
import { fetchPapers, fetchPaper, deletePaper as apiDeletePaper } from '@/services/paperApi'

interface PaperStore {
  papers: PaperListItem[]
  currentPaper: Paper | null
  loading: boolean

  loadPapers: () => Promise<void>
  loadPaper: (id: string) => Promise<void>
  removePaper: (id: string) => Promise<void>
  setCurrentPaper: (paper: Paper | null) => void
}

export const usePaperStore = create<PaperStore>((set) => ({
  papers: [],
  currentPaper: null,
  loading: false,

  loadPapers: async () => {
    set({ loading: true })
    try {
      const papers = await fetchPapers()
      set({ papers })
    } finally {
      set({ loading: false })
    }
  },

  loadPaper: async (id: string) => {
    set({ loading: true })
    try {
      const paper = await fetchPaper(id)
      set({ currentPaper: paper })
    } finally {
      set({ loading: false })
    }
  },

  removePaper: async (id: string) => {
    await apiDeletePaper(id)
    set((state) => ({
      papers: state.papers.filter((p) => p.id !== id),
    }))
  },

  setCurrentPaper: (paper) => set({ currentPaper: paper }),
}))
