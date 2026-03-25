import { useEffect, useRef, useState } from 'react'
import { Button, Card, Spin, Typography, message } from 'antd'
import {
  FilePdfOutlined,
  MenuFoldOutlined,
  ReloadOutlined,
} from '@ant-design/icons'
import { useUiStore } from '@/stores/uiStore'
import type { Paper } from '@/types'

const { Text } = Typography

interface Props {
  paper: Paper
  previewTrigger?: number
}

export default function RightPanel({ paper, previewTrigger }: Props) {
  const { toggleRight } = useUiStore()
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [pdfLoading, setPdfLoading] = useState(false)
  const prevTrigger = useRef(previewTrigger ?? 0)
  const pdfUrlRef = useRef<string | null>(null)

  useEffect(() => {
    return () => {
      if (pdfUrlRef.current) URL.revokeObjectURL(pdfUrlRef.current)
    }
  }, [])

  useEffect(() => {
    if (previewTrigger && previewTrigger > prevTrigger.current) {
      prevTrigger.current = previewTrigger
      handlePreviewPdf()
    }
  }, [previewTrigger]) // eslint-disable-line react-hooks/exhaustive-deps

  const handlePreviewPdf = async () => {
    setPdfLoading(true)
    try {
      const response = await fetch(`/api/papers/${paper.id}/export/preview`, {
        method: 'POST',
      })
      if (!response.ok) {
        const err = await response.json().catch(() => ({ detail: '编译失败' }))
        throw new Error(err.detail || '编译失败')
      }
      const blob = await response.blob()
      if (pdfUrlRef.current) URL.revokeObjectURL(pdfUrlRef.current)
      const newUrl = URL.createObjectURL(blob)
      pdfUrlRef.current = newUrl
      setPdfUrl(newUrl)
    } catch (e: unknown) {
      message.error((e as Error).message || 'PDF 预览失败')
    } finally {
      setPdfLoading(false)
    }
  }

  return (
    <div
      style={{
        width: 380,
        borderLeft: '1px solid #f0f0f0',
        display: 'flex',
        flexDirection: 'column',
        background: '#fafafa',
        flexShrink: 0,
      }}
    >
      <div style={{ padding: '8px 12px', borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'flex-end' }}>
        <Button type="text" size="small" icon={<MenuFoldOutlined />} onClick={toggleRight}>
          收起
        </Button>
      </div>

      <div style={{ flex: 1, padding: 12, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Card
          size="small"
          title={<><FilePdfOutlined /> PDF 预览</>}
          extra={
            <Button
              type="text"
              size="small"
              icon={<ReloadOutlined spin={pdfLoading} />}
              onClick={handlePreviewPdf}
              disabled={pdfLoading}
            >
              {pdfUrl ? '刷新' : '编译'}
            </Button>
          }
          style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
          styles={{ body: { flex: 1, padding: 0, overflow: 'hidden' } }}
        >
          {pdfLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
              <Spin tip="编译中..." />
            </div>
          ) : pdfUrl ? (
            <iframe
              src={pdfUrl}
              style={{ width: '100%', height: '100%', border: 'none' }}
              title="PDF Preview"
            />
          ) : (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: '#bfbfbf' }}>
              <div style={{ textAlign: 'center' }}>
                <FilePdfOutlined style={{ fontSize: 28, marginBottom: 8, display: 'block' }} />
                <Text type="secondary">点击「编译」生成 PDF 预览</Text>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
