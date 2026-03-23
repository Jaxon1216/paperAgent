import { useCallback, useEffect, useRef, useState } from 'react'
import { Button, Input, Space, Tag, Typography, message } from 'antd'
import {
  CheckOutlined,
  CloseOutlined,
  DownOutlined,
  EditOutlined,
  LoadingOutlined,
  LockOutlined,
  PauseCircleOutlined,
  RightOutlined,
  RobotOutlined,
  SearchOutlined,
  UnlockOutlined,
} from '@ant-design/icons'
import MDEditor from '@uiw/react-md-editor'
import type { Section } from '@/types'
import { usePaperStore } from '@/stores/paperStore'
import { countWords } from '@/utils/wordCount'
import { streamGenerateSection, streamPolishSection } from '@/services/aiApi'
import PolishModal from './PolishModal'

const { Title, Text } = Typography
const { TextArea } = Input

interface Props {
  section: Section | null
}

const STATUS_TAG: Record<string, { color: string; label: string }> = {
  empty: { color: 'default', label: '空白' },
  generating: { color: 'processing', label: '生成中' },
  draft: { color: 'blue', label: '草稿' },
  confirmed: { color: 'green', label: '已确认' },
}

export default function SectionEditor({ section }: Props) {
  const { patchSection, setSectionStatus } = usePaperStore()
  const [localContent, setLocalContent] = useState('')
  const [generating, setGenerating] = useState(false)
  const [polishOpen, setPolishOpen] = useState(false)
  const [polishing, setPolishing] = useState(false)
  const [instructionExpanded, setInstructionExpanded] = useState(false)
  const [localInstruction, setLocalInstruction] = useState('')
  const [searchVisible, setSearchVisible] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [matchIndex, setMatchIndex] = useState(0)
  const [matchPositions, setMatchPositions] = useState<number[]>([])
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const instructionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const sectionIdRef = useRef<string | null>(null)
  const abortRef = useRef<(() => void) | null>(null)
  const contentRef = useRef('')
  const editorContainerRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (section) {
      setLocalContent(section.content_md)
      contentRef.current = section.content_md
      sectionIdRef.current = section.id
      setLocalInstruction(section.ai_instruction || '')
      setInstructionExpanded(!!section.ai_instruction)
    }
  }, [section?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Sync content from store during external generation (generate-all flow)
  useEffect(() => {
    if (!section) return
    if (section.status !== 'generating' || generating || polishing) return
    const incoming = section.content_md || ''
    if (contentRef.current !== incoming) {
      contentRef.current = incoming
      setLocalContent(incoming)
    }
  }, [section?.content_md, section?.status, generating, polishing]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      if (instructionTimerRef.current) clearTimeout(instructionTimerRef.current)
      abortRef.current?.()
    }
  }, [])

  useEffect(() => {
    if (!searchTerm || !searchVisible) {
      setMatchPositions([])
      setMatchIndex(0)
      return
    }
    const lower = localContent.toLowerCase()
    const needle = searchTerm.toLowerCase()
    const positions: number[] = []
    let idx = 0
    while (idx < lower.length) {
      const found = lower.indexOf(needle, idx)
      if (found === -1) break
      positions.push(found)
      idx = found + 1
    }
    setMatchPositions(positions)
    setMatchIndex(0)
  }, [searchTerm, localContent, searchVisible])

  const selectMatchInTextarea = useCallback((pos: number, len: number) => {
    const container = editorContainerRef.current
    if (!container) return
    const ta = container.querySelector<HTMLTextAreaElement>('textarea.w-md-editor-text-input')
    if (!ta) return
    ta.focus()
    ta.setSelectionRange(pos, pos + len)
    const linesBefore = localContent.slice(0, pos).split('\n').length
    const lineHeight = 22
    ta.scrollTop = Math.max(0, (linesBefore - 3) * lineHeight)
  }, [localContent])

  const handleSearchNext = useCallback(() => {
    if (matchPositions.length === 0) return
    const next = (matchIndex + 1) % matchPositions.length
    setMatchIndex(next)
    selectMatchInTextarea(matchPositions[next], searchTerm.length)
  }, [matchPositions, matchIndex, searchTerm, selectMatchInTextarea])

  const handleSearchPrev = useCallback(() => {
    if (matchPositions.length === 0) return
    const prev = (matchIndex - 1 + matchPositions.length) % matchPositions.length
    setMatchIndex(prev)
    selectMatchInTextarea(matchPositions[prev], searchTerm.length)
  }, [matchPositions, matchIndex, searchTerm, selectMatchInTextarea])

  const openSearch = useCallback(() => {
    setSearchVisible(true)
    setTimeout(() => searchInputRef.current?.focus(), 50)
  }, [])

  const closeSearch = useCallback(() => {
    setSearchVisible(false)
    setSearchTerm('')
    setMatchPositions([])
  }, [])

  useEffect(() => {
    const container = editorContainerRef.current
    if (!container) return
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault()
        e.stopPropagation()
        openSearch()
      }
      if (e.key === 'Escape' && searchVisible) {
        closeSearch()
      }
    }
    container.addEventListener('keydown', handler, true)
    return () => container.removeEventListener('keydown', handler, true)
  }, [searchVisible, openSearch, closeSearch])

  const debouncedSave = useCallback(
    (value: string) => {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(async () => {
        if (!sectionIdRef.current) return
        try {
          await patchSection(sectionIdRef.current, { content_md: value })
        } catch {
          message.error('自动保存失败')
        }
      }, 1000)
    },
    [patchSection],
  )

  const handleInstructionChange = (value: string) => {
    setLocalInstruction(value)
    if (instructionTimerRef.current) clearTimeout(instructionTimerRef.current)
    instructionTimerRef.current = setTimeout(async () => {
      if (!sectionIdRef.current) return
      try {
        await patchSection(sectionIdRef.current, { ai_instruction: value })
      } catch {
        message.error('保存写作指令失败')
      }
    }, 800)
  }

  const handleChange = (value: string | undefined) => {
    const v = value ?? ''
    setLocalContent(v)
    contentRef.current = v
    debouncedSave(v)
  }

  const handleConfirm = async () => {
    if (!section) return
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      await patchSection(section.id, { content_md: localContent })
    }
    await setSectionStatus(section.id, 'confirmed')
    message.success('章节已确认')
  }

  const handleUnlock = async () => {
    if (!section) return
    await setSectionStatus(section.id, 'draft')
  }

  const handleStop = async () => {
    abortRef.current?.()
    abortRef.current = null
    const saved = contentRef.current
    if (section && saved) {
      await patchSection(section.id, { content_md: saved })
      await setSectionStatus(section.id, 'draft')
      message.info('已停止生成，当前内容已保存')
    }
    setGenerating(false)
    setPolishing(false)
  }

  const handleGenerate = async () => {
    if (!section) return
    setGenerating(true)
    setLocalContent('')
    contentRef.current = ''

    const { stream, abort } = streamGenerateSection(section.id)
    abortRef.current = abort

    try {
      for await (const event of stream) {
        if (event.type === 'chunk') {
          contentRef.current += (event.data.content as string) || ''
          setLocalContent(contentRef.current)
        } else if (event.type === 'error') {
          message.error((event.data.message as string) || 'AI 生成失败')
        }
      }
      if (contentRef.current) {
        await patchSection(section.id, { content_md: contentRef.current })
        await setSectionStatus(section.id, 'draft')
      }
    } catch (e: unknown) {
      if ((e as Error).name !== 'AbortError') {
        message.error('AI 生成失败')
      }
    } finally {
      setGenerating(false)
      abortRef.current = null
    }
  }

  const handlePolish = async (action: string, instruction: string) => {
    if (!section) return
    setPolishing(true)
    contentRef.current = ''

    const { stream, abort } = streamPolishSection(section.id, action, instruction)
    abortRef.current = abort

    try {
      for await (const event of stream) {
        if (event.type === 'chunk') {
          contentRef.current += (event.data.content as string) || ''
          setLocalContent(contentRef.current)
        } else if (event.type === 'error') {
          message.error((event.data.message as string) || 'AI 润色失败')
        }
      }
      if (contentRef.current) {
        await patchSection(section.id, { content_md: contentRef.current })
      }
      setPolishOpen(false)
    } catch (e: unknown) {
      if ((e as Error).name !== 'AbortError') {
        message.error('AI 润色失败')
      }
    } finally {
      setPolishing(false)
      abortRef.current = null
    }
  }

  if (!section) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: '#bfbfbf' }}>
        请在左侧选择一个章节
      </div>
    )
  }

  const isLocked = section.status === 'confirmed'
  const isBusy = generating || polishing
  const tag = STATUS_TAG[section.status] ?? STATUS_TAG.empty

  return (
    <div ref={editorContainerRef} tabIndex={-1} style={{ display: 'flex', flexDirection: 'column', height: '100%', outline: 'none' }}>
      <div
        style={{
          padding: '12px 20px',
          borderBottom: '1px solid #f0f0f0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexShrink: 0,
        }}
      >
        <Space>
          <Title level={5} style={{ margin: 0 }}>
            {section.title}
          </Title>
          <Tag color={isBusy ? 'processing' : tag.color}>
            {isBusy ? '生成中...' : tag.label}
          </Tag>
        </Space>

        <Space>
          {isBusy ? (
            <Button
              danger
              icon={<PauseCircleOutlined />}
              onClick={handleStop}
            >
              停止生成
            </Button>
          ) : (
            <>
              <Button
                icon={<RobotOutlined />}
                onClick={handleGenerate}
                disabled={isLocked}
              >
                AI 生成
              </Button>
              <Button
                icon={<EditOutlined />}
                onClick={() => setPolishOpen(true)}
                disabled={isLocked || !section.content_md}
              >
                AI 润色
              </Button>
            </>
          )}
          {isLocked ? (
            <Button icon={<UnlockOutlined />} onClick={handleUnlock} disabled={isBusy}>
              解锁编辑
            </Button>
          ) : (
            <Button
              type="primary"
              icon={<CheckOutlined />}
              onClick={handleConfirm}
              disabled={isBusy}
            >
              确认
            </Button>
          )}
          <Button
            icon={<SearchOutlined />}
            size="small"
            type="text"
            onClick={openSearch}
            title="搜索 (⌘F)"
          />
          {isLocked && (
            <LockOutlined style={{ color: '#52c41a', fontSize: 18 }} />
          )}
        </Space>
      </div>

      {searchVisible && (
        <div
          style={{
            padding: '6px 20px',
            borderBottom: '1px solid #f0f0f0',
            background: '#fafafa',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            flexShrink: 0,
          }}
        >
          <SearchOutlined style={{ color: '#999', fontSize: 13 }} />
          <input
            ref={searchInputRef}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.shiftKey ? handleSearchPrev() : handleSearchNext()
              }
              if (e.key === 'Escape') closeSearch()
            }}
            placeholder="搜索章节内容..."
            style={{
              flex: 1,
              border: '1px solid #d9d9d9',
              borderRadius: 4,
              padding: '3px 8px',
              fontSize: 13,
              outline: 'none',
            }}
          />
          <Text type="secondary" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
            {matchPositions.length > 0
              ? `${matchIndex + 1} / ${matchPositions.length}`
              : searchTerm
                ? '无匹配'
                : ''}
          </Text>
          <Button size="small" type="text" disabled={matchPositions.length === 0} onClick={handleSearchPrev}>
            ↑
          </Button>
          <Button size="small" type="text" disabled={matchPositions.length === 0} onClick={handleSearchNext}>
            ↓
          </Button>
          <Button size="small" type="text" icon={<CloseOutlined />} onClick={closeSearch} />
        </div>
      )}

      <div style={{ flexShrink: 0, borderBottom: '1px solid #f0f0f0' }}>
        <div
          onClick={() => setInstructionExpanded((v) => !v)}
          style={{
            padding: '6px 20px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: localInstruction ? '#f6ffed' : '#fafafa',
            userSelect: 'none',
            fontSize: 13,
          }}
        >
          {instructionExpanded ? <DownOutlined style={{ fontSize: 10 }} /> : <RightOutlined style={{ fontSize: 10 }} />}
          <RobotOutlined style={{ color: '#1677ff' }} />
          <Text type="secondary" style={{ fontSize: 13 }}>
            AI 写作指令
          </Text>
          {localInstruction && !instructionExpanded && (
            <Text type="secondary" ellipsis style={{ flex: 1, fontSize: 12, marginLeft: 8 }}>
              {localInstruction}
            </Text>
          )}
        </div>
        {instructionExpanded && (
          <div style={{ padding: '8px 20px 12px' }}>
            <TextArea
              value={localInstruction}
              onChange={(e) => handleInstructionChange(e.target.value)}
              placeholder="协调 Agent 的写作规划会自动填入此处，你也可以手动编辑。AI 生成时将按照此指令撰写本章节。"
              autoSize={{ minRows: 2, maxRows: 6 }}
              disabled={isLocked || isBusy}
              style={{ fontSize: 13 }}
            />
          </div>
        )}
      </div>

      <div style={{ flex: 1, overflow: 'auto' }} data-color-mode="light">
        <MDEditor
          value={localContent}
          onChange={handleChange}
          height="100%"
          preview={isLocked ? 'preview' : 'live'}
          hideToolbar={isLocked}
          style={{ border: 'none', borderRadius: 0 }}
        />
      </div>

      <div
        style={{
          padding: '5px 20px',
          borderTop: '1px solid #E4E9F0',
          background: '#F7F8FA',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
          fontSize: 11,
          color: '#8694A0',
          userSelect: 'none',
        }}
      >
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>{countWords(localContent).toLocaleString()} 字</span>
        <span>{isLocked ? '已锁定' : isBusy ? '生成中...' : '编辑中'}</span>
      </div>

      <PolishModal
        open={polishOpen}
        loading={polishing}
        onCancel={() => setPolishOpen(false)}
        onExecute={handlePolish}
      />
    </div>
  )
}
