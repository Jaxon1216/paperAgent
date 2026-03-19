import api from './api'
import type { Section } from '@/types'

export async function fetchSections(paperId: string): Promise<Section[]> {
  const { data } = await api.get<Section[]>(`/papers/${paperId}/sections`)
  return data
}

export async function createSection(
  paperId: string,
  payload: { title: string; order: number; content_md?: string; ai_instruction?: string },
): Promise<Section> {
  const { data } = await api.post<Section>(`/papers/${paperId}/sections`, payload)
  return data
}

export async function updateSection(
  sectionId: string,
  payload: Partial<Pick<Section, 'title' | 'content_md' | 'status' | 'ai_instruction'>>,
): Promise<Section> {
  const { data } = await api.put<Section>(`/sections/${sectionId}`, payload)
  return data
}

export async function updateSectionOrder(sectionId: string, order: number): Promise<Section> {
  const { data } = await api.put<Section>(`/sections/${sectionId}/order`, { order })
  return data
}

export async function updateSectionStatus(sectionId: string, status: string): Promise<Section> {
  const { data } = await api.put<Section>(`/sections/${sectionId}/status`, { status })
  return data
}

export async function deleteSection(sectionId: string): Promise<void> {
  await api.delete(`/sections/${sectionId}`)
}
