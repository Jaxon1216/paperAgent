import { Result, Button } from 'antd'
import { useNavigate } from 'react-router-dom'

export default function Settings() {
  const navigate = useNavigate()

  return (
    <div style={{ padding: 40 }}>
      <Result
        title="LLM 设置"
        subTitle="设置页将在 Phase 3 实现"
        extra={
          <Button type="primary" onClick={() => navigate('/')}>
            返回首页
          </Button>
        }
      />
    </div>
  )
}
