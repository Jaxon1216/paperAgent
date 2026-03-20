import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Steps, Button, message, Typography } from 'antd'
import { ArrowLeftOutlined } from '@ant-design/icons'
import type { Template, SectionOverride } from '@/types'
import TemplateSelect from './TemplateSelect'
import PaperInfo from './PaperInfo'
import SectionConfig from './SectionConfig'
import { createPaper } from '@/services/paperApi'

const { Title } = Typography

interface PaperFormData {
  title: string
  template_id: string
  target_words: number
  metadata_fields: Record<string, string>
  requirements: string
}

export default function PaperNew() {
  const navigate = useNavigate()
  const [current, setCurrent] = useState(0)
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null)
  const [formData, setFormData] = useState<PaperFormData>({
    title: '',
    template_id: '',
    target_words: 8000,
    metadata_fields: {},
    requirements: '',
  })
  const [sections, setSections] = useState<SectionOverride[]>([])
  const [creating, setCreating] = useState(false)

  const isAiTemplate = selectedTemplate && selectedTemplate.default_sections.length === 0

  const handleTemplateSelect = (template: Template) => {
    setSelectedTemplate(template)
    setFormData((prev) => ({ ...prev, template_id: template.id }))
    setSections(
      template.default_sections.map((ds) => ({
        title: ds.title,
        order: ds.order,
        enabled: true,
      })),
    )
    setCurrent(1)
  }

  const handleInfoSubmit = (data: Omit<PaperFormData, 'template_id'>) => {
    setFormData((prev) => ({ ...prev, ...data }))
    if (isAiTemplate) {
      handleCreateDirect({ ...formData, ...data })
    } else {
      setCurrent(2)
    }
  }

  const handleCreateDirect = async (data: PaperFormData) => {
    setCreating(true)
    try {
      const paper = await createPaper({ ...data, sections: [] })
      message.success('论文创建成功，请使用「AI 规划」生成章节')
      navigate(`/papers/${paper.id}/edit`)
    } catch {
      message.error('创建失败，请重试')
    } finally {
      setCreating(false)
    }
  }

  const handleCreate = async () => {
    setCreating(true)
    try {
      const paper = await createPaper({
        ...formData,
        sections,
      })
      message.success('论文创建成功')
      navigate(`/papers/${paper.id}/edit`)
    } catch {
      message.error('创建失败，请重试')
    } finally {
      setCreating(false)
    }
  }

  const steps = isAiTemplate
    ? [{ title: '选择模板' }, { title: '填写信息' }]
    : [{ title: '选择模板' }, { title: '填写信息' }, { title: '确认结构' }]

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '40px 24px' }}>
      <Button
        type="text"
        icon={<ArrowLeftOutlined />}
        onClick={() => navigate('/')}
        style={{ marginBottom: 16 }}
      >
        返回首页
      </Button>

      <Title level={3}>新建论文</Title>

      <Steps current={current} items={steps} style={{ marginBottom: 40 }} />

      {current === 0 && <TemplateSelect onSelect={handleTemplateSelect} />}

      {current === 1 && selectedTemplate && (
        <PaperInfo
          template={selectedTemplate}
          initialData={formData}
          onSubmit={handleInfoSubmit}
          onBack={() => setCurrent(0)}
          isLastStep={!!isAiTemplate}
          loading={creating}
        />
      )}

      {current === 2 && selectedTemplate && (
        <SectionConfig
          template={selectedTemplate}
          targetWords={formData.target_words}
          sections={sections}
          onChange={setSections}
          onSubmit={handleCreate}
          onBack={() => setCurrent(1)}
          loading={creating}
        />
      )}
    </div>
  )
}
