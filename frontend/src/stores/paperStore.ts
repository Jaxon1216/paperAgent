import { create } from 'zustand'
import type { Paper, PaperListItem, Section, Reference } from '@/types'
import { fetchPapers, fetchPaper, updatePaper, deletePaper as apiDeletePaper } from '@/services/paperApi'
import { createSection as apiCreateSection, deleteSection as apiDeleteSection, updateSection as apiUpdateSection, updateSectionStatus as apiUpdateSectionStatus, updateSectionOrder as apiUpdateSectionOrder } from '@/services/sectionApi'
import { createReference as apiCreateReference, updateReference as apiUpdateReference, deleteReference as apiDeleteReference } from '@/services/referenceApi'

interface PaperStore {
  papers: PaperListItem[]
  currentPaper: Paper | null
  loading: boolean

  loadPapers: () => Promise<void>
  loadPaper: (id: string) => Promise<void>
  removePaper: (id: string) => Promise<void>
  setCurrentPaper: (paper: Paper | null) => void

  addSection: (paperId: string, title: string, order: number) => Promise<void>
  removeSection: (sectionId: string) => Promise<void>
  patchSection: (sectionId: string, data: Partial<Pick<Section, 'title' | 'content_md' | 'ai_instruction'>>) => Promise<void>
  setSectionStatus: (sectionId: string, status: Section['status']) => Promise<void>
  reorderSection: (sectionId: string, newOrder: number) => Promise<void>
  updateSectionLocal: (sectionId: string, data: Partial<Pick<Section, 'content_md' | 'status'>>) => void

  addReference: (paperId: string, content: string) => Promise<void>
  patchReference: (refId: string, content: string) => Promise<void>
  removeReference: (refId: string) => Promise<void>

  updateMeta: (paperId: string, data: Partial<Pick<Paper, 'title' | 'target_words' | 'metadata_fields' | 'requirements'>>) => Promise<void>
}

function replaceSection(paper: Paper, updated: Section): Paper {
  return {
    ...paper,
    sections: paper.sections.map((s) => (s.id === updated.id ? updated : s)),
  }
}

function replaceReference(paper: Paper, updated: Reference): Paper {
  return {
    ...paper,
    references: paper.references.map((r) => (r.id === updated.id ? updated : r)),
  }
}

export const usePaperStore = create<PaperStore>((set, get) => ({
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
    set((state) => ({ papers: state.papers.filter((p) => p.id !== id) }))
  },

  setCurrentPaper: (paper) => set({ currentPaper: paper }),

  addSection: async (paperId, title, order) => {
    const created = await apiCreateSection(paperId, { title, order })
    const paper = get().currentPaper
    if (paper) {
      const sections = [...paper.sections, created].sort((a, b) => a.order - b.order)
      set({ currentPaper: { ...paper, sections } })
    }
  },

  removeSection: async (sectionId) => {
    await apiDeleteSection(sectionId)
    const paper = get().currentPaper
    if (paper) {
      set({ currentPaper: { ...paper, sections: paper.sections.filter((s) => s.id !== sectionId) } })
    }
  },

  patchSection: async (sectionId, data) => {
    const updated = await apiUpdateSection(sectionId, data)
    const paper = get().currentPaper
    if (paper) set({ currentPaper: replaceSection(paper, updated) })
  },

  setSectionStatus: async (sectionId, status) => {
    const updated = await apiUpdateSectionStatus(sectionId, status)
    const paper = get().currentPaper
    if (paper) set({ currentPaper: replaceSection(paper, updated) })
  },

  updateSectionLocal: (sectionId, data) => {
    const paper = get().currentPaper
    if (!paper) return
    set({
      currentPaper: {
        ...paper,
        sections: paper.sections.map((s) =>
          s.id === sectionId ? { ...s, ...data } : s
        ),
      },
    })
  },

  reorderSection: async (sectionId, newOrder) => {
    const updated = await apiUpdateSectionOrder(sectionId, newOrder)
    const paper = get().currentPaper
    if (!paper) return
    const sections = paper.sections
      .map((s) => (s.id === updated.id ? updated : s))
      .sort((a, b) => a.order - b.order)
    set({ currentPaper: { ...paper, sections } })
  },

  addReference: async (paperId, content) => {
    const ref = await apiCreateReference(paperId, content)
    const paper = get().currentPaper
    if (paper) {
      set({ currentPaper: { ...paper, references: [...paper.references, ref] } })
    }
  },

  patchReference: async (refId, content) => {
    const updated = await apiUpdateReference(refId, content)
    const paper = get().currentPaper
    if (paper) set({ currentPaper: replaceReference(paper, updated) })
  },

  removeReference: async (refId) => {
    await apiDeleteReference(refId)
    const paper = get().currentPaper
    if (paper) {
      set({ currentPaper: { ...paper, references: paper.references.filter((r) => r.id !== refId) } })
    }
  },

  updateMeta: async (paperId, data) => {
    const updated = await updatePaper(paperId, data)
    set({ currentPaper: updated })
  },
}))
