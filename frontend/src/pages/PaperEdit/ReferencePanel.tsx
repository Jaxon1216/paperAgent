import { useRef } from 'react'
import { Button, Input, Space, Typography, message } from 'antd'
import { DeleteOutlined, LinkOutlined, PlusOutlined } from '@ant-design/icons'
import type { Paper } from '@/types'
import { usePaperStore } from '@/stores/paperStore'

const { Text } = Typography

interface Props {
  paper: Paper
}

export default function ReferencePanel({ paper }: Props) {
  const { addReference, patchReference, removeReference } = usePaperStore()
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  const handleAdd = async () => {
    try {
      await addReference(paper.id, '')
    } catch {
      message.error('添加失败')
    }
  }

  const handleChange = (refId: string, value: string) => {
    if (saveTimers.current[refId]) clearTimeout(saveTimers.current[refId])
    saveTimers.current[refId] = setTimeout(async () => {
      try {
        await patchReference(refId, value)
      } catch {
        message.error('保存失败')
      }
    }, 800)
  }

  const handleDelete = async (refId: string) => {
    try {
      await removeReference(refId)
    } catch {
      message.error('删除失败')
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <Space>
          <a href="https://www.cnki.net/" target="_blank" rel="noreferrer">
            <Button size="small" type="link" icon={<LinkOutlined />}>知网</Button>
          </a>
          <a href="https://scholar.google.com/" target="_blank" rel="noreferrer">
            <Button size="small" type="link" icon={<LinkOutlined />}>Google Scholar</Button>
          </a>
        </Space>
        <Button size="small" icon={<PlusOutlined />} onClick={handleAdd}>
          添加
        </Button>
      </div>

      {paper.references.length === 0 ? (
        <Text type="secondary" style={{ fontSize: 12 }}>
          暂无参考文献，点击「添加」或从知网/Google Scholar 查找后手动录入
        </Text>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {paper.references.map((ref, idx) => (
            <div key={ref.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
              <Text type="secondary" style={{ lineHeight: '30px', flexShrink: 0, width: 28, textAlign: 'right' }}>
                [{idx + 1}]
              </Text>
              <Input.TextArea
                defaultValue={ref.content}
                autoSize={{ minRows: 1, maxRows: 3 }}
                placeholder="请输入参考文献内容"
                onChange={(e) => handleChange(ref.id, e.target.value)}
                style={{ flex: 1 }}
                size="small"
              />
              <Button
                type="text"
                danger
                size="small"
                icon={<DeleteOutlined />}
                onClick={() => handleDelete(ref.id)}
                style={{ marginTop: 2 }}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
