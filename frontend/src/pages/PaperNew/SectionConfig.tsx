import { useState } from 'react'
import { Button, Checkbox, Input, List, Space, Typography } from 'antd'
import {
  PlusOutlined,
  HolderOutlined,
  DeleteOutlined,
} from '@ant-design/icons'
import type { Template, SectionOverride } from '@/types'

const { Text } = Typography

interface Props {
  template: Template
  targetWords: number
  sections: SectionOverride[]
  onChange: (sections: SectionOverride[]) => void
  onSubmit: () => void
  onBack: () => void
  loading: boolean
}

export default function SectionConfig({
  template,
  targetWords,
  sections,
  onChange,
  onSubmit,
  onBack,
  loading,
}: Props) {
  const [newTitle, setNewTitle] = useState('')

  const toggleSection = (index: number) => {
    const templateSection = template.default_sections.find(
      (ds) => ds.title === sections[index].title,
    )
    if (templateSection?.is_required) return

    const next = [...sections]
    next[index] = { ...next[index], enabled: !next[index].enabled }
    onChange(next)
  }

  const addCustomSection = () => {
    if (!newTitle.trim()) return
    const maxOrder = Math.max(...sections.map((s) => s.order), -1)
    onChange([
      ...sections,
      { title: newTitle.trim(), order: maxOrder + 1, enabled: true },
    ])
    setNewTitle('')
  }

  const removeSection = (index: number) => {
    const templateSection = template.default_sections.find(
      (ds) => ds.title === sections[index].title,
    )
    if (templateSection) return
    onChange(sections.filter((_, i) => i !== index))
  }

  const getEstimatedWords = (title: string) => {
    const ds = template.default_sections.find((s) => s.title === title)
    if (!ds) return null
    return Math.round(targetWords * ds.estimated_word_ratio)
  }

  const enabledCount = sections.filter((s) => s.enabled).length

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Text type="secondary">
          共 {enabledCount} 个启用章节，目标总字数 {targetWords} 字
        </Text>
      </div>

      <List
        bordered
        dataSource={sections}
        renderItem={(section, index) => {
          const estimated = getEstimatedWords(section.title)
          const isTemplate = template.default_sections.some(
            (ds) => ds.title === section.title,
          )
          const isRequired = template.default_sections.find(
            (ds) => ds.title === section.title,
          )?.is_required

          return (
            <List.Item
              style={{
                opacity: section.enabled ? 1 : 0.5,
                padding: '12px 16px',
              }}
              actions={
                !isTemplate
                  ? [
                      <DeleteOutlined
                        key="delete"
                        onClick={() => removeSection(index)}
                        style={{ color: '#ff4d4f' }}
                      />,
                    ]
                  : undefined
              }
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
                <HolderOutlined style={{ color: '#bfbfbf', cursor: 'grab' }} />
                <Checkbox
                  checked={section.enabled}
                  onChange={() => toggleSection(index)}
                  disabled={isRequired}
                />
                <div style={{ flex: 1 }}>
                  <Text strong>{section.title}</Text>
                  {estimated !== null && (
                    <Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>
                      ~{estimated} 字
                    </Text>
                  )}
                  {isRequired && (
                    <Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>
                      (必需)
                    </Text>
                  )}
                </div>
              </div>
            </List.Item>
          )
        }}
      />

      <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
        <Input
          placeholder="自定义章节名称"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onPressEnter={addCustomSection}
          style={{ maxWidth: 300 }}
        />
        <Button icon={<PlusOutlined />} onClick={addCustomSection}>
          添加章节
        </Button>
      </div>

      <div style={{ marginTop: 32 }}>
        <Space>
          <Button onClick={onBack}>上一步</Button>
          <Button type="primary" size="large" onClick={onSubmit} loading={loading}>
            创建论文
          </Button>
        </Space>
      </div>
    </div>
  )
}
