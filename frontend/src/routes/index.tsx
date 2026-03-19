import { Routes, Route, Navigate } from 'react-router-dom'
import Home from '@/pages/Home'
import PaperNew from '@/pages/PaperNew'
import PaperEdit from '@/pages/PaperEdit'
import Settings from '@/pages/Settings'

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/papers/new" element={<PaperNew />} />
      <Route path="/papers/:id/edit" element={<PaperEdit />} />
      <Route path="/settings" element={<Settings />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
