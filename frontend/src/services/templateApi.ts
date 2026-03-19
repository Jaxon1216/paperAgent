import api from './api'
import type { Template } from '@/types'

export async function fetchTemplates(): Promise<Template[]> {
  const { data } = await api.get<Template[]>('/templates')
  return data
}

export async function fetchTemplate(templateId: string): Promise<Template> {
  const { data } = await api.get<Template>(`/templates/${templateId}`)
  return data
}
