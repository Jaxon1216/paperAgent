export interface CoverField {
  key: string
  label: string
  required: boolean
  placeholder?: string
  multiline?: boolean
}

export interface DefaultSection {
  title: string
  order: number
  description: string
  estimated_word_ratio: number
  is_required: boolean
}

export interface Template {
  id: string
  name: string
  description: string
  language: 'zh' | 'en'
  cover_fields: CoverField[]
  default_sections: DefaultSection[]
  typst_template: string
}

export interface Section {
  id: string
  paper_id: string
  title: string
  order: number
  content_md: string
  status: 'empty' | 'generating' | 'draft' | 'confirmed'
  ai_instruction: string
  created_at?: string
  updated_at?: string
}

export interface Reference {
  id: string
  paper_id: string
  order: number
  content: string
  created_at?: string
}

export interface Paper {
  id: string
  title: string
  template_id: string
  target_words: number
  metadata_fields: Record<string, string>
  requirements: string
  status: 'drafting' | 'completed'
  sections: Section[]
  references: Reference[]
  created_at?: string
  updated_at?: string
}

export interface PaperListItem {
  id: string
  title: string
  template_id: string
  target_words: number
  status: string
  section_count: number
  created_at?: string
  updated_at?: string
}

export interface LLMSettings {
  api_key: string
  model: string
  base_url: string
}

export interface SectionOverride {
  title: string
  order: number
  enabled: boolean
}

export interface PaperCreatePayload {
  title: string
  template_id: string
  target_words: number
  metadata_fields: Record<string, string>
  requirements: string
  sections?: SectionOverride[]
}
