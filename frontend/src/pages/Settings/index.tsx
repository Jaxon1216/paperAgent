import { useEffect, useState } from 'react'
import {
  Button,
  Card,
  Form,
  Input,
  Select,
  Space,
  Typography,
  message,
} from 'antd'
import { ArrowLeftOutlined, CheckCircleOutlined, SaveOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import api from '@/services/api'
import type { LLMSettings } from '@/types'

const { Title, Text } = Typography

const PRESET_MODELS = [
  { label: 'DeepSeek Chat', value: 'deepseek/deepseek-chat' },
  { label: 'GPT-4o', value: 'gpt-4o' },
  { label: 'GPT-4o Mini', value: 'gpt-4o-mini' },
  { label: 'Claude 3.5 Sonnet', value: 'claude-3-5-sonnet-20241022' },
  { label: 'Claude 3 Haiku', value: 'claude-3-haiku-20240307' },
]

export default function Settings() {
  const navigate = useNavigate()
  const [form] = Form.useForm<LLMSettings>()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [customModel, setCustomModel] = useState(false)
  const [testing, setTesting] = useState(false)

  useEffect(() => {
    setLoading(true)
    api
      .get<LLMSettings>('/settings')
      .then(({ data }) => {
        form.setFieldsValue(data)
        const isPreset = PRESET_MODELS.some((m) => m.value === data.model)
        setCustomModel(!isPreset)
      })
      .finally(() => setLoading(false))
  }, [form])

  const handleSave = async () => {
    try {
      const values = await form.validateFields()
      setSaving(true)
      await api.put('/settings', values)
      message.success('设置已保存')
    } catch {
      // validation errors handled by form
    } finally {
      setSaving(false)
    }
  }

  const handleTest = async () => {
    setTesting(true)
    try {
      const { data } = await api.post<{ ok: boolean; reply?: string; error?: string }>(
        '/settings/test',
      )
      if (data.ok) {
        message.success(`连接成功！模型回复：${data.reply}`)
      } else {
        message.error(`连接失败：${data.error}`)
      }
    } catch {
      message.error('请求失败，请检查后端是否运行')
    } finally {
      setTesting(false)
    }
  }

  return (
    <div style={{ maxWidth: 600, margin: '40px auto', padding: '0 24px' }}>
      <Space style={{ marginBottom: 24 }}>
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate('/')}
        >
          返回首页
        </Button>
      </Space>

      <Card loading={loading}>
        <Title level={4} style={{ marginTop: 0 }}>
          LLM 设置
        </Title>
        <Text type="secondary" style={{ display: 'block', marginBottom: 24 }}>
          配置大语言模型的 API 信息，支持通过 LiteLLM 调用多种模型。
        </Text>

        <Form form={form} layout="vertical" autoComplete="off">
          <Form.Item
            name="api_key"
            label="API Key"
            rules={[{ required: true, message: '请输入 API Key' }]}
          >
            <Input.Password
              placeholder="sk-..."
              autoComplete="off"
            />
          </Form.Item>

          <Form.Item label="模型" required>
            {customModel ? (
              <Space.Compact style={{ width: '100%' }}>
                <Form.Item
                  name="model"
                  noStyle
                  rules={[{ required: true, message: '请输入模型名称' }]}
                >
                  <Input
                    placeholder="provider/model-name"
                    style={{ width: 'calc(100% - 100px)' }}
                  />
                </Form.Item>
                <Button onClick={() => setCustomModel(false)}>选择预设</Button>
              </Space.Compact>
            ) : (
              <Space.Compact style={{ width: '100%' }}>
                <Form.Item
                  name="model"
                  noStyle
                  rules={[{ required: true, message: '请选择模型' }]}
                >
                  <Select
                    options={PRESET_MODELS}
                    placeholder="选择模型"
                    style={{ width: 'calc(100% - 100px)' }}
                  />
                </Form.Item>
                <Button onClick={() => setCustomModel(true)}>自定义</Button>
              </Space.Compact>
            )}
          </Form.Item>

          <Form.Item
            name="base_url"
            label="Base URL（可选）"
            tooltip="如使用自定义代理或第三方服务，请填写完整 URL"
          >
            <Input placeholder="https://api.example.com/v1" />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button
                type="primary"
                icon={<SaveOutlined />}
                onClick={handleSave}
                loading={saving}
                size="large"
              >
                保存设置
              </Button>
              <Button
                icon={<CheckCircleOutlined />}
                onClick={handleTest}
                loading={testing}
                size="large"
              >
                验证连接
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>
    </div>
  )
}
