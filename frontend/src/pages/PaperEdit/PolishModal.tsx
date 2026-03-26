import { useState } from 'react'
import { Modal, Radio, Input, Space, Typography } from 'antd'

const { Text } = Typography

interface Props {
  open: boolean
  loading: boolean
  onCancel: () => void
  onExecute: (action: string, instruction: string) => void
}

const ACTIONS = [
  { value: 'polish', label: '润色优化' },
  { value: 'expand', label: '扩写丰富' },
  { value: 'compress', label: '精简压缩' },
  { value: 'rewrite', label: '重写改写' },
  { value: 'format_refs', label: '规范引用格式' },
  { value: 'custom', label: '自定义指令' },
]

export default function PolishModal({ open, loading, onCancel, onExecute }: Props) {
  const [action, setAction] = useState('polish')
  const [instruction, setInstruction] = useState('')

  const handleOk = () => {
    onExecute(action, instruction)
  }

  return (
    <Modal
      title="AI 润色"
      open={open}
      onOk={handleOk}
      onCancel={onCancel}
      okText="开始润色"
      cancelText="取消"
      confirmLoading={loading}
      destroyOnHidden
    >
      <Space direction="vertical" style={{ width: '100%' }} size="middle">
        <div>
          <Text strong>选择操作：</Text>
          <Radio.Group
            value={action}
            onChange={(e) => setAction(e.target.value)}
            style={{ marginTop: 8 }}
          >
            <Space direction="vertical">
              {ACTIONS.map((a) => (
                <Radio key={a.value} value={a.value}>
                  {a.label}
                </Radio>
              ))}
            </Space>
          </Radio.Group>
        </div>
        {action === 'custom' && (
          <div>
            <Text strong>自定义指令：</Text>
            <Input.TextArea
              rows={3}
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              placeholder="请输入你的润色要求..."
              style={{ marginTop: 8 }}
            />
          </div>
        )}
      </Space>
    </Modal>
  )
}
