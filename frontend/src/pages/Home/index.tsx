import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Button,
  Card,
  Col,
  Empty,
  Modal,
  Row,
  Spin,
  Tag,
  Typography,
} from 'antd'
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  FileTextOutlined,
  SettingOutlined,
} from '@ant-design/icons'
import { usePaperStore } from '@/stores/paperStore'

const { Title, Text } = Typography

const TEMPLATE_NAMES: Record<string, string> = {
  'math-modeling-cn': '数模竞赛（国赛）',
  'general-academic': '通用学术论文',
  'mcm-icm': '美赛 (MCM/ICM)',
}

export default function Home() {
  const navigate = useNavigate()
  const papers = usePaperStore((s) => s.papers)
  const loading = usePaperStore((s) => s.loading)
  const loadPapers = usePaperStore((s) => s.loadPapers)
  const removePaper = usePaperStore((s) => s.removePaper)

  useEffect(() => {
    loadPapers()
  }, [loadPapers])

  const handleDelete = (id: string, title: string) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除论文「${title}」吗？此操作不可恢复。`,
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: () => removePaper(id),
    })
  }

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '40px 24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
        <div>
          <Title level={2} style={{ margin: 0 }}>PaperAgent</Title>
          <Text type="secondary">AI 学术论文生成平台</Text>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <Button icon={<SettingOutlined />} onClick={() => navigate('/settings')}>
            设置
          </Button>
          <Button type="primary" icon={<PlusOutlined />} size="large" onClick={() => navigate('/papers/new')}>
            新建论文
          </Button>
        </div>
      </div>

      <Spin spinning={loading}>
        {papers.length === 0 && !loading ? (
          <Card>
            <Empty
              image={<FileTextOutlined style={{ fontSize: 64, color: '#bfbfbf' }} />}
              description={
                <div>
                  <Text type="secondary" style={{ fontSize: 16 }}>还没有论文</Text>
                  <br />
                  <Text type="secondary">点击「新建论文」开始你的第一篇</Text>
                </div>
              }
            >
              <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/papers/new')}>
                新建论文
              </Button>
            </Empty>
          </Card>
        ) : (
          <Row gutter={[16, 16]}>
            {papers.map((paper) => (
              <Col xs={24} sm={12} lg={8} key={paper.id}>
                <Card
                  hoverable
                  onClick={() => navigate(`/papers/${paper.id}/edit`)}
                  actions={[
                    <EditOutlined key="edit" onClick={(e) => { e.stopPropagation(); navigate(`/papers/${paper.id}/edit`) }} />,
                    <DeleteOutlined key="delete" onClick={(e) => { e.stopPropagation(); handleDelete(paper.id, paper.title) }} />,
                  ]}
                >
                  <Card.Meta
                    title={
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text ellipsis style={{ maxWidth: '70%', fontWeight: 600 }}>{paper.title}</Text>
                        <Tag color={paper.status === 'completed' ? 'green' : 'blue'}>
                          {paper.status === 'completed' ? '已完成' : '编辑中'}
                        </Tag>
                      </div>
                    }
                    description={
                      <div style={{ marginTop: 8 }}>
                        <div><Text type="secondary">模板：{TEMPLATE_NAMES[paper.template_id] ?? paper.template_id}</Text></div>
                        <div><Text type="secondary">目标字数：{paper.target_words} 字 · {paper.section_count} 个章节</Text></div>
                        <div><Text type="secondary" style={{ fontSize: 12 }}>更新于 {formatDate(paper.updated_at)}</Text></div>
                      </div>
                    }
                  />
                </Card>
              </Col>
            ))}
          </Row>
        )}
      </Spin>
    </div>
  )
}
