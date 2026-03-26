import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button, Result, Spin } from 'antd'
import { MenuUnfoldOutlined } from '@ant-design/icons'
import { usePaperStore } from '@/stores/paperStore'
import { useUiStore } from '@/stores/uiStore'
import OutlineSidebar from './OutlineSidebar'
import SectionEditor from './SectionEditor'
import RightPanel from './RightPanel'

export default function PaperEdit() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const currentPaper = usePaperStore((s) => s.currentPaper)
  const loading = usePaperStore((s) => s.loading)
  const loadPaper = usePaperStore((s) => s.loadPaper)
  const { leftCollapsed, rightCollapsed, toggleLeft, toggleRight } = useUiStore()
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null)
  const [pdfPreviewTrigger, setPdfPreviewTrigger] = useState(0)

  useEffect(() => {
    if (id) loadPaper(id)
  }, [id, loadPaper])

  const firstSectionId = currentPaper?.sections?.[0]?.id
  useEffect(() => {
    if (firstSectionId && !activeSectionId) {
      setActiveSectionId(firstSectionId)
    }
  }, [firstSectionId, activeSectionId])

  if (loading || !currentPaper) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        {!loading && !currentPaper ? (
          <Result
            status="error"
            title="加载失败"
            subTitle="论文不存在或网络异常，请返回重试"
            extra={<Button type="primary" onClick={() => navigate('/')}>返回首页</Button>}
          />
        ) : (
          <Spin size="large" />
        )}
      </div>
    )
  }

  const activeSection = currentPaper.sections.find((s) => s.id === activeSectionId) ?? null

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {leftCollapsed ? (
        <div style={{ borderRight: '1px solid #f0f0f0', padding: '12px 4px', background: '#fafafa' }}>
          <Button type="text" size="small" icon={<MenuUnfoldOutlined />} onClick={toggleLeft} />
        </div>
      ) : (
        <OutlineSidebar
          paper={currentPaper}
          activeSectionId={activeSectionId}
          onSelect={setActiveSectionId}
          onPreviewPdf={() => {
            if (rightCollapsed) toggleRight()
            setPdfPreviewTrigger((n) => n + 1)
          }}
        />
      )}

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        <SectionEditor section={activeSection} />
      </div>

      {!rightCollapsed && (
        <RightPanel
          paper={currentPaper}
          previewTrigger={pdfPreviewTrigger}
        />
      )}
    </div>
  )
}
