import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Button, Spin } from 'antd'
import { MenuUnfoldOutlined } from '@ant-design/icons'
import { usePaperStore } from '@/stores/paperStore'
import { useUiStore } from '@/stores/uiStore'
import OutlineSidebar from './OutlineSidebar'
import SectionEditor from './SectionEditor'
import RightPanel from './RightPanel'

export default function PaperEdit() {
  const { id } = useParams<{ id: string }>()
  const { currentPaper, loading, loadPaper } = usePaperStore()
  const { leftCollapsed, rightCollapsed, toggleLeft, toggleRight } = useUiStore()
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null)
  const [pdfPreviewTrigger, setPdfPreviewTrigger] = useState(0)

  useEffect(() => {
    if (id) loadPaper(id)
  }, [id, loadPaper])

  useEffect(() => {
    if (currentPaper?.sections.length && !activeSectionId) {
      setActiveSectionId(currentPaper.sections[0].id)
    }
  }, [currentPaper, activeSectionId])

  if (loading || !currentPaper) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Spin size="large" />
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
          activeSectionId={activeSectionId}
          previewTrigger={pdfPreviewTrigger}
        />
      )}
    </div>
  )
}
