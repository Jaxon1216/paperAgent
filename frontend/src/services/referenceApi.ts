import api from './api'
import type { Reference } from '@/types'

export async function fetchReferences(paperId: string): Promise<Reference[]> {
  const { data } = await api.get<Reference[]>(`/papers/${paperId}/references`)
  return data
}

export async function createReference(paperId: string, content: string): Promise<Reference> {
  const { data } = await api.post<Reference>(`/papers/${paperId}/references`, { content })
  return data
}

export async function updateReference(refId: string, content: string): Promise<Reference> {
  const { data } = await api.put<Reference>(`/references/${refId}`, { content })
  return data
}

export async function deleteReference(refId: string): Promise<void> {
  await api.delete(`/references/${refId}`)
}

export async function reorderReferences(
  paperId: string,
  items: { id: string; order: number }[],
): Promise<Reference[]> {
  const { data } = await api.put<Reference[]>(`/papers/${paperId}/references/order`, { items })
  return data
}
