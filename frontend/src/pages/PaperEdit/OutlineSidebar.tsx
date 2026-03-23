import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Button,
  Collapse,
  Input,
  Popconfirm,
  Select,
  Space,
  Tooltip,
  Typography,
  message,
} from 'antd'
import {
  ArrowLeftOutlined,
  BulbOutlined,
  CheckCircleFilled,
  CopyOutlined,
  DeleteOutlined,
  DownloadOutlined,
  EditFilled,
  FilePdfOutlined,
  LinkOutlined,
  LoadingOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  MinusCircleOutlined,
  PauseCircleOutlined,
  PlusOutlined,
  ProfileOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons'
import { Progress } from 'antd'
import type { CoverField, Paper, Section } from '@/types'
import { useUiStore } from '@/stores/uiStore'
import { countWords } from '@/utils/wordCount'
import { usePaperStore } from '@/stores/paperStore'
import { planStructure, planInstructions, streamGenerateAll } from '@/services/aiApi'
import { fetchTemplate } from '@/services/templateApi'

const { Text } = Typography
const { TextArea } = Input

interface Props {
  paper: Paper
  activeSectionId: string | null
  onSelect: (id: string) => void
  onPreviewPdf: () => void
}

const STATUS_ICON: Record<string, React.ReactNode> = {
  empty: <MinusCircleOutlined style={{ color: '#bfbfbf', fontSize: 14 }} />,
  generating: <EditFilled style={{ color: '#faad14', fontSize: 14 }} />,
  draft: <EditFilled style={{ color: '#1677ff', fontSize: 14 }} />,
  confirmed: <CheckCircleFilled style={{ color: '#52c41a', fontSize: 14 }} />,
}

export default function OutlineSidebar({ paper, activeSectionId, onSelect, onPreviewPdf }: Props) {
  const navigate = useNavigate()
  const { toggleLeft, rightCollapsed, toggleRight } = useUiStore()
  const { addSection, removeSection, reorderSection, loadPaper, updateMeta, setSectionStatus, updateSectionLocal, addReference, patchReference, removeReference } = usePaperStore()

  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const [planningStructure, setPlanningStructure] = useState(false)
  const [planningInstructions, setPlanningInstructions] = useState(false)
  const [generatingAll, setGeneratingAll] = useState(false)
  const [generatingSectionId, setGeneratingSectionId] = useState<string | null>(null)
  const [newSectionTitle, setNewSectionTitle] = useState('')
  const [refKeywords, setRefKeywords] = useState(paper.metadata_fields?.['_ai_reference_keywords'] || '')
  const [coverFields, setCoverFields] = useState<CoverField[]>([])
  const dragItemRef = useRef<Section | null>(null)
  const abortRef = useRef<(() => void) | null>(null)
  const refTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const reqTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const coverTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  useEffect(() => {
    fetchTemplate(paper.template_id).then((t) => setCoverFields(t.cover_fields)).catch(() => {})
  }, [paper.template_id])

  const isBusy = planningStructure || planningInstructions || generatingAll

  const allConfirmed = paper.sections.length > 0 && paper.sections.every((s) => s.status === 'confirmed')
  const hasContent = paper.sections.some((s) => s.content_md?.trim())

  const sectionWordCounts = paper.sections.map((s) => countWords(s.content_md))
  const totalWords = sectionWordCounts.reduce((sum, c) => sum + c, 0)
  const targetWords = paper.target_words || 0
  const wordPercent = targetWords > 0 ? Math.min(Math.round((totalWords / targetWords) * 100), 100) : 0

  const handlePlanStructure = async () => {
    setPlanningStructure(true)
    try {
      await planStructure(paper.id)
      await loadPaper(paper.id)
      message.success('章节结构规划完成，可增删调整后进行下一步')
    } catch (e: unknown) {
      message.error((e as Error).message || 'AI 章节规划失败')
    } finally {
      setPlanningStructure(false)
    }
  }

  const handlePlanInstructions = async () => {
    if (!paper.sections.length) {
      message.warning('请先规划或添加章节')
      return
    }
    setPlanningInstructions(true)
    try {
      await planInstructions(paper.id)
      await loadPaper(paper.id)
      message.success('写作指令生成完成，可在编辑器中查看和修改')
    } catch (e: unknown) {
      message.error((e as Error).message || 'AI 提示词规划失败')
    } finally {
      setPlanningInstructions(false)
    }
  }

  const handleAddSection = async () => {
    const title = newSectionTitle.trim()
    if (!title) return
    const maxOrder = paper.sections.reduce((m, s) => Math.max(m, s.order), -1)
    await addSection(paper.id, title, maxOrder + 1)
    setNewSectionTitle('')
  }

  const handleDeleteSection = async (sectionId: string) => {
    await removeSection(sectionId)
    message.success('章节已删除')
  }

  const handleCoverFieldChange = useCallback((key: string, value: string) => {
    if (coverTimers.current[key]) clearTimeout(coverTimers.current[key])
    coverTimers.current[key] = setTimeout(async () => {
      const meta = { ...(paper.metadata_fields || {}), [key]: value }
      await updateMeta(paper.id, { metadata_fields: meta })
    }, 800)
  }, [paper.id, paper.metadata_fields, updateMeta])

  const handleConfirmAll = async () => {
    const unconfirmed = paper.sections.filter((s) => s.status !== 'confirmed' && s.content_md?.trim())
    for (const s of unconfirmed) {
      await setSectionStatus(s.id, 'confirmed')
    }
    message.success(`已确认 ${unconfirmed.length} 个章节`)
  }

  const handleDragStart = useCallback((section: Section) => {
    dragItemRef.current = section
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent, sectionId: string) => {
    e.preventDefault()
    setDragOverId(sectionId)
  }, [])

  const handleDrop = useCallback(
    async (targetSection: Section) => {
      setDragOverId(null)
      const src = dragItemRef.current
      if (!src || src.id === targetSection.id) return
      await reorderSection(src.id, targetSection.order)
      await loadPaper(paper.id)
    },
    [reorderSection, loadPaper, paper.id],
  )

  const streamContentRef = useRef<Record<string, string>>({})

  const handleGenerateAll = async () => {
    if (!paper.sections.length) {
      message.warning('请先添加章节')
      return
    }
    setGeneratingAll(true)
    streamContentRef.current = {}
    const { stream, abort } = streamGenerateAll(paper.id)
    abortRef.current = abort

    try {
      for await (const event of stream) {
        if (event.type === 'section_start') {
          const sid = event.data.section_id as string
          setGeneratingSectionId(sid)
          onSelect(sid)
          streamContentRef.current[sid] = ''
          updateSectionLocal(sid, { content_md: '', status: 'generating' })
        } else if (event.type === 'chunk') {
          const sid = event.data.section_id as string
          const chunk = (event.data.content as string) || ''
          streamContentRef.current[sid] = (streamContentRef.current[sid] || '') + chunk
          updateSectionLocal(sid, { content_md: streamContentRef.current[sid] })
        } else if (event.type === 'section_done') {
          const sid = event.data.section_id as string
          const content = (event.data.content as string) || streamContentRef.current[sid] || ''
          updateSectionLocal(sid, { content_md: content, status: 'draft' })
          setGeneratingSectionId(null)
        } else if (event.type === 'keywords') {
          const kw = (event.data.keywords as string) || ''
          if (kw) setRefKeywords(kw)
        } else if (event.type === 'keywords_start') {
          message.info('正在提取参考文献关键词...')
        } else if (event.type === 'error') {
          message.error((event.data.message as string) || 'AI 生成失败')
        } else if (event.type === 'done') {
          message.success('所有章节生成完成')
        }
      }
    } catch (e: unknown) {
      if ((e as Error).name !== 'AbortError') message.error('AI 生成失败')
    } finally {
      setGeneratingAll(false)
      setGeneratingSectionId(null)
      abortRef.current = null
      streamContentRef.current = {}
      await loadPaper(paper.id)
    }
  }

  const handleStopAll = async () => {
    abortRef.current?.()
    abortRef.current = null
    setGeneratingAll(false)
    setGeneratingSectionId(null)
    message.info('已停止生成')
    await loadPaper(paper.id)
  }

  const handleRequirementsChange = (value: string) => {
    if (reqTimerRef.current) clearTimeout(reqTimerRef.current)
    reqTimerRef.current = setTimeout(async () => {
      try {
        await updateMeta(paper.id, { requirements: value })
      } catch {
        message.error('保存失败')
      }
    }, 800)
  }

  const handleRefChange = (refId: string, value: string) => {
    if (refTimers.current[refId]) clearTimeout(refTimers.current[refId])
    refTimers.current[refId] = setTimeout(async () => {
      try { await patchReference(refId, value) } catch { message.error('保存失败') }
    }, 800)
  }

  const getSectionIcon = (section: Section) => {
    if (generatingSectionId === section.id) return <LoadingOutlined style={{ color: '#faad14', fontSize: 14 }} />
    return STATUS_ICON[section.status] ?? STATUS_ICON.empty
  }

  return (
    <div
      style={{
        width: 300,
        borderRight: '1px solid #f0f0f0',
        display: 'flex',
        flexDirection: 'column',
        background: '#fafafa',
        flexShrink: 0,
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div style={{ padding: '10px 12px 6px', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <Button type="text" size="small" icon={<ArrowLeftOutlined />} onClick={() => navigate('/')} />
        <Text strong ellipsis style={{ flex: 1, fontSize: 14 }}>{paper.title}</Text>
        <Button type="text" size="small" icon={<MenuFoldOutlined />} onClick={toggleLeft} />
      </div>

      {/* 3-Step AI Actions */}
      <div style={{ padding: '4px 12px 8px', display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 6 }}>
          <Tooltip title="AI 根据论文要求自动规划章节结构">
            <Button
              icon={<ProfileOutlined />}
              loading={planningStructure}
              onClick={handlePlanStructure}
              disabled={isBusy && !planningStructure}
              block
              size="small"
            >
              {planningStructure ? '规划中...' : '① 章节规划'}
            </Button>
          </Tooltip>
          <Tooltip title="AI 为每个章节生成详细写作指令">
            <Button
              icon={<BulbOutlined />}
              loading={planningInstructions}
              onClick={handlePlanInstructions}
              disabled={isBusy && !planningInstructions}
              block
              size="small"
            >
              {planningInstructions ? '生成中...' : '② 写作指令'}
            </Button>
          </Tooltip>
        </div>
        {generatingAll ? (
          <Button icon={<PauseCircleOutlined />} danger onClick={handleStopAll} block size="small">停止生成</Button>
        ) : (
          <Button icon={<ThunderboltOutlined />} type="primary" onClick={handleGenerateAll} disabled={isBusy} block size="small">
            ③ 开始生成
          </Button>
        )}
      </div>

      {/* Scrollable content */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {/* Word Count Stats */}
        {paper.sections.length > 0 && (
          <div style={{ padding: '4px 12px 0', marginBottom: -2 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
              <Text type="secondary" style={{ fontSize: 11 }}>
                字数：<Text strong style={{ fontSize: 11 }}>{totalWords.toLocaleString()}</Text>
                {targetWords > 0 && <span> / {targetWords.toLocaleString()}</span>}
              </Text>
              {targetWords > 0 && (
                <Text type="secondary" style={{ fontSize: 11 }}>{wordPercent}%</Text>
              )}
            </div>
            {targetWords > 0 && (
              <Progress
                percent={wordPercent}
                size="small"
                showInfo={false}
                strokeColor={wordPercent >= 100 ? '#52c41a' : '#1677ff'}
                style={{ margin: 0 }}
              />
            )}
          </div>
        )}

        {/* Section List */}
        <div style={{ padding: '0 0 4px' }}>
          <div style={{ padding: '4px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text type="secondary" style={{ fontSize: 12, fontWeight: 600 }}>章节</Text>
            <Text type="secondary" style={{ fontSize: 11 }}>{paper.sections.length} 个</Text>
          </div>
          {paper.sections.length === 0 && (
            <div style={{ padding: '8px 12px' }}>
              <Text type="secondary" style={{ fontSize: 12 }}>暂无章节，点击「① 章节规划」或手动添加</Text>
            </div>
          )}
          {paper.sections.map((section, idx) => {
            const wc = sectionWordCounts[idx]
            return (
              <div
                key={section.id}
                draggable={!isBusy}
                onDragStart={() => handleDragStart(section)}
                onDragOver={(e) => handleDragOver(e, section.id)}
                onDragLeave={() => setDragOverId(null)}
                onDrop={() => handleDrop(section)}
                onClick={() => onSelect(section.id)}
                style={{
                  padding: '6px 12px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  background:
                    generatingSectionId === section.id
                      ? '#fff7e6'
                      : section.id === activeSectionId
                        ? '#e6f4ff'
                        : 'transparent',
                  borderLeft:
                    section.id === activeSectionId
                      ? '3px solid #1677ff'
                      : '3px solid transparent',
                  borderTop:
                    dragOverId === section.id
                      ? '2px solid #1677ff'
                      : '2px solid transparent',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={(e) => {
                  if (section.id !== activeSectionId && generatingSectionId !== section.id)
                    e.currentTarget.style.background = '#f0f0f0'
                }}
                onMouseLeave={(e) => {
                  if (section.id !== activeSectionId && generatingSectionId !== section.id)
                    e.currentTarget.style.background = 'transparent'
                }}
              >
                {getSectionIcon(section)}
                <Text ellipsis style={{ flex: 1, fontSize: 13 }}>{section.title}</Text>
                {wc > 0 && (
                  <Text type="secondary" style={{ fontSize: 10, flexShrink: 0 }}>{wc.toLocaleString()}</Text>
                )}
                {section.ai_instruction && (
                  <Tooltip title="已有写作指令">
                    <BulbOutlined style={{ color: '#faad14', fontSize: 11 }} />
                  </Tooltip>
                )}
                {!isBusy && (
                  <Popconfirm
                    title="删除此章节？"
                    onConfirm={(e) => { e?.stopPropagation(); handleDeleteSection(section.id) }}
                    onCancel={(e) => e?.stopPropagation()}
                    okText="删除"
                    cancelText="取消"
                  >
                    <DeleteOutlined
                      onClick={(e) => e.stopPropagation()}
                      style={{ color: '#bfbfbf', fontSize: 12 }}
                      onMouseEnter={(e) => { (e.target as HTMLElement).style.color = '#ff4d4f' }}
                      onMouseLeave={(e) => { (e.target as HTMLElement).style.color = '#bfbfbf' }}
                    />
                  </Popconfirm>
                )}
              </div>
            )
          })}
          <div style={{ padding: '6px 12px', display: 'flex', gap: 4 }}>
            <Input
              size="small"
              placeholder="新章节名称"
              value={newSectionTitle}
              onChange={(e) => setNewSectionTitle(e.target.value)}
              onPressEnter={handleAddSection}
              style={{ flex: 1, fontSize: 12 }}
            />
            <Button size="small" type="dashed" icon={<PlusOutlined />} onClick={handleAddSection} disabled={!newSectionTitle.trim()} />
          </div>
        </div>

        {/* Collapsible panels */}
        <Collapse
          ghost
          size="small"
          defaultActiveKey={[]}
          style={{ padding: '0 4px' }}
          items={[
            {
              key: 'refs',
              label: (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                  <Text style={{ fontSize: 12, fontWeight: 600 }}>参考文献</Text>
                  <Text type="secondary" style={{ fontSize: 11 }}>{paper.references.length} 条</Text>
                </div>
              ),
              children: (
                <div style={{ padding: '0 4px' }}>
                  <Space size={4} style={{ marginBottom: 8 }}>
                    <a href="https://www.cnki.net/" target="_blank" rel="noreferrer">
                      <Button size="small" type="link" icon={<LinkOutlined />} style={{ padding: '0 4px', fontSize: 11 }}>知网</Button>
                    </a>
                    <a href="https://scholar.google.com/" target="_blank" rel="noreferrer">
                      <Button size="small" type="link" icon={<LinkOutlined />} style={{ padding: '0 4px', fontSize: 11 }}>Scholar</Button>
                    </a>
                    <Button size="small" icon={<PlusOutlined />} onClick={() => addReference(paper.id, '')} style={{ fontSize: 11 }}>添加</Button>
                  </Space>
                  {paper.references.length === 0 ? (
                    <Text type="secondary" style={{ fontSize: 10, display: 'block', whiteSpace: 'pre-line', color: '#bbb', lineHeight: 1.6 }}>
                      {'格式示例：\n[1] 作者.文章标题[J].期刊名,年份(期号).\n[2] 作者.书名[M].出版地:出版社,年份.'}
                    </Text>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {paper.references.map((ref, idx) => (
                        <div key={ref.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 4 }}>
                          <Text type="secondary" style={{ lineHeight: '24px', flexShrink: 0, fontSize: 11 }}>[{idx + 1}]</Text>
                          <Input.TextArea
                            defaultValue={ref.content}
                            autoSize={{ minRows: 1, maxRows: 3 }}
                            placeholder="作者.标题[J].期刊名,年份(期号)."
                            onChange={(e) => handleRefChange(ref.id, e.target.value)}
                            style={{ flex: 1, fontSize: 11 }}
                            size="small"
                          />
                          <Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={() => removeReference(ref.id)} style={{ marginTop: 1 }} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ),
            },
            ...(refKeywords ? [{
              key: 'keywords',
              label: <Text style={{ fontSize: 12, fontWeight: 600 }}>AI 关键词建议</Text>,
              children: (
                <div style={{ padding: '0 4px' }}>
                  <Input.TextArea
                    value={refKeywords}
                    readOnly
                    autoSize={{ minRows: 2, maxRows: 10 }}
                    style={{ fontSize: 11, background: '#fff' }}
                  />
                  <Button
                    type="link"
                    size="small"
                    icon={<CopyOutlined />}
                    onClick={() => { navigator.clipboard.writeText(refKeywords); message.success('已复制') }}
                    style={{ padding: '4px 0', fontSize: 11 }}
                  >
                    复制关键词
                  </Button>
                </div>
              ),
            }] : []),
            {
              key: 'requirements',
              label: <Text style={{ fontSize: 12, fontWeight: 600 }}>论文要求</Text>,
              children: (
                <div style={{ padding: '0 4px' }}>
                  <TextArea
                    defaultValue={paper.requirements}
                    onChange={(e) => handleRequirementsChange(e.target.value)}
                    placeholder="论文的题目要求、写作说明等。此信息将发送给 AI 作为写作参考。"
                    autoSize={{ minRows: 3, maxRows: 10 }}
                    style={{ fontSize: 12 }}
                  />
                </div>
              ),
            },
            ...(coverFields.length > 0 ? [{
              key: 'cover',
              label: <Text style={{ fontSize: 12, fontWeight: 600 }}>封面信息</Text>,
              children: (
                <div style={{ padding: '0 4px', display: 'flex', flexDirection: 'column' as const, gap: 8 }}>
                  {coverFields.map((field) => (
                    <div key={field.key}>
                      <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 2 }}>{field.label}</Text>
                      {field.multiline ? (
                        <TextArea
                          defaultValue={paper.metadata_fields?.[field.key] || ''}
                          onChange={(e) => handleCoverFieldChange(field.key, e.target.value)}
                          placeholder={field.placeholder || `请输入${field.label}`}
                          autoSize={{ minRows: 2, maxRows: 4 }}
                          style={{ fontSize: 12 }}
                        />
                      ) : (
                        <Input
                          size="small"
                          defaultValue={paper.metadata_fields?.[field.key] || ''}
                          onChange={(e) => handleCoverFieldChange(field.key, e.target.value)}
                          placeholder={field.placeholder || `请输入${field.label}`}
                          style={{ fontSize: 12 }}
                        />
                      )}
                    </div>
                  ))}
                  <Text type="secondary" style={{ fontSize: 10 }}>
                    填写后导出 PDF 自动生成封面页
                  </Text>
                </div>
              ),
            }] : []),
          ]}
        />
      </div>

      {/* Bottom actions */}
      <div style={{ padding: '8px 12px', borderTop: '1px solid #f0f0f0', display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
        {!allConfirmed && hasContent && (
          <Button
            type="primary"
            ghost
            icon={<CheckCircleFilled />}
            size="small"
            block
            onClick={handleConfirmAll}
            disabled={isBusy}
          >
            全部确认
          </Button>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Text type="secondary" style={{ fontSize: 11, flexShrink: 0 }}>标题编号</Text>
          <Select
            size="small"
            value={paper.metadata_fields?.['_heading_style'] || 'arabic'}
            onChange={async (val) => {
              const meta = { ...(paper.metadata_fields || {}), _heading_style: val }
              await updateMeta(paper.id, { metadata_fields: meta })
            }}
            style={{ flex: 1, fontSize: 11 }}
            options={[
              { value: 'arabic', label: '1. / 1.1 / 1.1.1' },
              { value: 'chinese', label: '一、/ 1. / (1)' },
            ]}
          />
        </div>
        <Tooltip title={!allConfirmed ? '请先确认所有章节后再导出 PDF' : ''}>
          <div style={{ display: 'flex', gap: 6 }}>
            <Button icon={<FilePdfOutlined />} block size="small" onClick={onPreviewPdf} disabled={!allConfirmed}>
              预览 PDF
            </Button>
            <Button icon={<DownloadOutlined />} block size="small" onClick={() => window.open(`/api/papers/${paper.id}/export/download`, '_blank')} disabled={!allConfirmed}>
              下载 PDF
            </Button>
          </div>
        </Tooltip>
        <Button
          type="text"
          size="small"
          icon={rightCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
          onClick={toggleRight}
          block
        >
          {rightCollapsed ? '展开右栏' : '收起右栏'}
        </Button>
      </div>
    </div>
  )
}
