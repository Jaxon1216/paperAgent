import { Button, Collapse, Form, Input, InputNumber, Space, Typography } from 'antd'
import type { Template } from '@/types'

const { TextArea } = Input
const { Text } = Typography

interface FormValues {
  title: string
  target_words: number
  requirements: string
  [key: string]: string | number
}

interface Props {
  template: Template
  initialData: {
    title: string
    target_words: number
    requirements: string
    metadata_fields: Record<string, string>
  }
  onSubmit: (data: {
    title: string
    target_words: number
    requirements: string
    metadata_fields: Record<string, string>
  }) => void
  onBack: () => void
}

export default function PaperInfo({ template, initialData, onSubmit, onBack }: Props) {
  const [form] = Form.useForm<FormValues>()

  const hasCoverData = Object.values(initialData.metadata_fields).some((v) => v !== '')

  const defaultValues: FormValues = {
    title: initialData.title,
    target_words: initialData.target_words,
    requirements: initialData.requirements,
    ...Object.fromEntries(
      template.cover_fields.map((f) => [`cover_${f.key}`, initialData.metadata_fields[f.key] ?? '']),
    ),
  }

  const handleFinish = (values: FormValues) => {
    const metadata_fields: Record<string, string> = {}
    for (const field of template.cover_fields) {
      const val = values[`cover_${field.key}`]
      if (val !== undefined && val !== '') {
        metadata_fields[field.key] = String(val)
      }
    }

    onSubmit({
      title: values.title,
      target_words: values.target_words,
      requirements: values.requirements,
      metadata_fields,
    })
  }

  return (
    <Form
      form={form}
      layout="vertical"
      initialValues={defaultValues}
      onFinish={handleFinish}
      style={{ maxWidth: 600 }}
    >
      <Form.Item
        label="论文标题"
        name="title"
        rules={[{ required: true, message: '请输入论文标题' }]}
      >
        <Input placeholder="请输入论文标题" size="large" />
      </Form.Item>

      <Form.Item
        label="目标字数"
        name="target_words"
        rules={[{ required: true, message: '请输入目标字数' }]}
      >
        <InputNumber
          min={1000}
          max={50000}
          step={500}
          addonAfter="字"
          style={{ width: '100%' }}
        />
      </Form.Item>

      <Form.Item label="题目要求 / 附加说明" name="requirements">
        <TextArea
          rows={4}
          placeholder="请粘贴题目原文或描述你的需求，AI 将据此生成论文内容"
        />
      </Form.Item>

      {template.cover_fields.length > 0 && (
        <Collapse
          defaultActiveKey={hasCoverData ? ['cover'] : []}
          ghost
          style={{ marginBottom: 16, background: '#fafafa', borderRadius: 8 }}
          items={[
            {
              key: 'cover',
              label: (
                <Text type="secondary">
                  封面信息（可选，不填则不生成封面页）
                </Text>
              ),
              children: (
                <>
                  {template.cover_fields.map((field) => (
                    <Form.Item
                      key={field.key}
                      label={field.label}
                      name={`cover_${field.key}`}
                    >
                      {field.multiline ? (
                        <TextArea
                          rows={3}
                          placeholder={field.placeholder || `请输入${field.label}`}
                        />
                      ) : (
                        <Input placeholder={field.placeholder || `请输入${field.label}`} />
                      )}
                    </Form.Item>
                  ))}
                </>
              ),
            },
          ]}
        />
      )}

      <Form.Item style={{ marginTop: 24 }}>
        <Space>
          <Button onClick={onBack}>上一步</Button>
          <Button type="primary" htmlType="submit">下一步</Button>
        </Space>
      </Form.Item>
    </Form>
  )
}
