import { useParams } from 'react-router-dom'
import { Result, Button } from 'antd'
import { useNavigate } from 'react-router-dom'

export default function PaperEdit() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  return (
    <div style={{ padding: 40 }}>
      <Result
        title="论文编辑器"
        subTitle={`论文 ID: ${id} — 编辑器将在 Phase 2 实现`}
        extra={
          <Button type="primary" onClick={() => navigate('/')}>
            返回首页
          </Button>
        }
      />
    </div>
  )
}
