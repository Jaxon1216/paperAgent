import { create } from 'zustand'

interface UiStore {
  leftCollapsed: boolean
  rightCollapsed: boolean
  toggleLeft: () => void
  toggleRight: () => void
}

export const useUiStore = create<UiStore>((set) => ({
  leftCollapsed: false,
  rightCollapsed: false,
  toggleLeft: () => set((s) => ({ leftCollapsed: !s.leftCollapsed })),
  toggleRight: () => set((s) => ({ rightCollapsed: !s.rightCollapsed })),
}))
