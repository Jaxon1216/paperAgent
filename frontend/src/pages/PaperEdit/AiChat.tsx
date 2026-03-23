import { useEffect, useRef, useState } from 'react'
import { Button, Input, Typography } from 'antd'
import { RobotOutlined, SendOutlined, UserOutlined } from '@ant-design/icons'
import type { Paper } from '@/types'
import { streamChat } from '@/services/aiApi'

const { Text } = Typography

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface Props {
  paper: Paper
  activeSectionId: string | null
}

export default function AiChat({ paper, activeSectionId }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const abortRef = useRef<(() => void) | null>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const prevSectionId = useRef<string | null>(null)

  useEffect(() => {
    if (activeSectionId !== prevSectionId.current) {
      setMessages([])
      prevSectionId.current = activeSectionId
    }
  }, [activeSectionId])

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight
    }
  }, [messages])

  const handleSend = async () => {
    const text = input.trim()
    if (!text || streaming) return

    const userMsg: ChatMessage = { role: 'user', content: text }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInput('')
    setStreaming(true)

    const apiMessages = newMessages.map((m) => ({
      role: m.role,
      content: m.content,
    }))

    const { stream, abort } = streamChat(
      paper.id,
      activeSectionId || '',
      apiMessages,
    )
    abortRef.current = abort

    let assistantContent = ''
    setMessages((prev) => [...prev, { role: 'assistant', content: '' }])

    try {
      for await (const event of stream) {
        if (event.type === 'chunk') {
          assistantContent += (event.data.content as string) || ''
          setMessages((prev) => {
            const updated = [...prev]
            updated[updated.length - 1] = {
              role: 'assistant',
              content: assistantContent,
            }
            return updated
          })
        }
      }
    } catch {
      if (!assistantContent) {
        setMessages((prev) => {
          const updated = [...prev]
          updated[updated.length - 1] = {
            role: 'assistant',
            content: '抱歉，回复出错了。请检查 LLM 设置。',
          }
          return updated
        })
      }
    } finally {
      setStreaming(false)
      abortRef.current = null
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const sectionName = paper.sections.find((s) => s.id === activeSectionId)?.title

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {sectionName && (
        <div style={{ padding: '6px 12px', fontSize: 12, color: '#8c8c8c', borderBottom: '1px solid #f0f0f0' }}>
          当前章节：{sectionName}
        </div>
      )}

      <div
        ref={listRef}
        style={{ flex: 1, overflow: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: 12 }}
      >
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', color: '#bfbfbf', marginTop: 40 }}>
            <RobotOutlined style={{ fontSize: 28, marginBottom: 8, display: 'block' }} />
            <Text type="secondary">在此与 AI 对话讨论论文内容</Text>
          </div>
        )}
        {messages.map((msg, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              gap: 8,
              alignItems: 'flex-start',
              flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
            }}
          >
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                background: msg.role === 'user' ? '#1677ff' : '#f0f0f0',
                color: msg.role === 'user' ? '#fff' : '#595959',
                fontSize: 14,
              }}
            >
              {msg.role === 'user' ? <UserOutlined /> : <RobotOutlined />}
            </div>
            <div
              style={{
                maxWidth: '80%',
                padding: '8px 12px',
                borderRadius: 8,
                background: msg.role === 'user' ? '#1677ff' : '#f5f5f5',
                color: msg.role === 'user' ? '#fff' : '#262626',
                fontSize: 13,
                lineHeight: 1.6,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {msg.content || (streaming && i === messages.length - 1 ? '...' : '')}
            </div>
          </div>
        ))}
      </div>

      <div style={{ padding: '8px 12px', borderTop: '1px solid #f0f0f0', display: 'flex', gap: 8 }}>
        <Input.TextArea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="输入消息，Enter 发送..."
          autoSize={{ minRows: 1, maxRows: 4 }}
          style={{ flex: 1, resize: 'none' }}
          disabled={streaming}
        />
        <Button
          type="primary"
          icon={<SendOutlined />}
          onClick={handleSend}
          disabled={!input.trim() || streaming}
          loading={streaming}
        />
      </div>
    </div>
  )
}
