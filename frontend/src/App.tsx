import { Layout } from 'antd'
import AppRoutes from '@/routes'

const { Content } = Layout

export default function App() {
  return (
    <Layout style={{ minHeight: '100vh', background: '#f5f5f5' }}>
      <Content>
        <AppRoutes />
      </Content>
    </Layout>
  )
}
