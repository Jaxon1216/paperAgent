import { useEffect, useState } from 'react'
import { Card, Col, Row, Spin, Tag, Typography } from 'antd'
import { FileTextOutlined, RobotOutlined } from '@ant-design/icons'
import type { Template } from '@/types'
import { fetchTemplates } from '@/services/templateApi'

const { Text } = Typography

interface Props {
  onSelect: (template: Template) => void
}

export default function TemplateSelect({ onSelect }: Props) {
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchTemplates()
      .then(setTemplates)
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return <Spin style={{ display: 'block', textAlign: 'center', padding: 60 }} />
  }

  const isAiTemplate = (t: Template) => t.default_sections.length === 0

  return (
    <Row gutter={[16, 16]}>
      {templates.map((t) => (
        <Col xs={24} sm={12} key={t.id}>
          <Card
            hoverable
            onClick={() => onSelect(t)}
            style={{
              height: '100%',
              borderColor: isAiTemplate(t) ? '#1677ff' : undefined,
            }}
          >
            <div style={{ display: 'flex', gap: 16 }}>
              {isAiTemplate(t) ? (
                <RobotOutlined style={{ fontSize: 36, color: '#722ed1', flexShrink: 0, marginTop: 4 }} />
              ) : (
                <FileTextOutlined style={{ fontSize: 36, color: '#1677ff', flexShrink: 0, marginTop: 4 }} />
              )}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <Text strong style={{ fontSize: 16 }}>{t.name}</Text>
                  <Tag>{t.language === 'zh' ? '中文' : 'English'}</Tag>
                  {isAiTemplate(t) && <Tag color="purple">推荐</Tag>}
                </div>
                <Text type="secondary">{t.description}</Text>
                <div style={{ marginTop: 8 }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {isAiTemplate(t)
                      ? 'AI 根据题目自动规划章节'
                      : `${t.default_sections.length} 个预设章节`}
                  </Text>
                </div>
              </div>
            </div>
          </Card>
        </Col>
      ))}
    </Row>
  )
}
