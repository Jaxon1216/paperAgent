import { useEffect, useState } from 'react'
import { Form, Input, InputNumber, Typography, message } from 'antd'
import type { Paper, Template } from '@/types'
import { fetchTemplate } from '@/services/templateApi'
import { usePaperStore } from '@/stores/paperStore'

const { TextArea } = Input
const { Text } = Typography

interface Props {
  paper: Paper
}

export default function CoverPanel({ paper }: Props) {
  const updateMeta = usePaperStore((s) => s.updateMeta)
  const [template, setTemplate] = useState<Template | null>(null)
  const [form] = Form.useForm()

  useEffect(() => {
    fetchTemplate(paper.template_id).then(setTemplate)
  }, [paper.template_id])

  useEffect(() => {
    form.setFieldsValue({
      title: paper.title,
      target_words: paper.target_words,
      ...Object.fromEntries(
        (template?.cover_fields ?? []).map((f) => [`cover_${f.key}`, paper.metadata_fields[f.key] ?? '']),
      ),
    })
  }, [paper.id, template, form]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSave = async () => {
    const values = form.getFieldsValue()
    const metadata_fields: Record<string, string> = {}
    for (const field of template?.cover_fields ?? []) {
      const val = values[`cover_${field.key}`]
      if (val !== undefined && val !== '') {
        metadata_fields[field.key] = String(val)
      }
    }

    try {
      await updateMeta(paper.id, {
        title: values.title,
        target_words: values.target_words,
        metadata_fields,
      })
    } catch {
      message.error('保存失败')
    }
  }

  return (
    <Form form={form} layout="vertical" size="small" onBlur={handleSave}>
      <div style={{ display: 'flex', gap: 12 }}>
        <Form.Item label="论文标题" name="title" style={{ flex: 1, marginBottom: 8 }}>
          <Input />
        </Form.Item>
        <Form.Item label="目标字数" name="target_words" style={{ width: 140, marginBottom: 8 }}>
          <InputNumber min={1000} max={50000} step={500} addonAfter="字" style={{ width: '100%' }} />
        </Form.Item>
      </div>

      {template && template.cover_fields.length > 0 && (
        <>
          <Text type="secondary" style={{ fontSize: 12, marginBottom: 8, display: 'block' }}>
            封面字段（不填则不生成封面页）
          </Text>
          {template.cover_fields.map((field) => (
            <Form.Item key={field.key} label={field.label} name={`cover_${field.key}`} style={{ marginBottom: 8 }}>
              {field.multiline ? (
                <TextArea rows={2} placeholder={field.placeholder} />
              ) : (
                <Input placeholder={field.placeholder} />
              )}
            </Form.Item>
          ))}
        </>
      )}
    </Form>
  )
}
