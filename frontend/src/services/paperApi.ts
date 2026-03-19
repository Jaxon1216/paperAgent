import api from './api'
import type { Paper, PaperCreatePayload, PaperListItem } from '@/types'

export async function fetchPapers(): Promise<PaperListItem[]> {
  const { data } = await api.get<PaperListItem[]>('/papers')
  return data
}

export async function fetchPaper(paperId: string): Promise<Paper> {
  const { data } = await api.get<Paper>(`/papers/${paperId}`)
  return data
}

export async function createPaper(payload: PaperCreatePayload): Promise<Paper> {
  const { data } = await api.post<Paper>('/papers', payload)
  return data
}

export async function updatePaper(
  paperId: string,
  payload: Partial<Pick<Paper, 'title' | 'target_words' | 'metadata_fields' | 'requirements'>>,
): Promise<Paper> {
  const { data } = await api.put<Paper>(`/papers/${paperId}`, payload)
  return data
}

export async function deletePaper(paperId: string): Promise<void> {
  await api.delete(`/papers/${paperId}`)
}
