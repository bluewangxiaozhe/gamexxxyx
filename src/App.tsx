import { lazy, Suspense } from 'react'
import { Routes, Route, Outlet } from 'react-router-dom'
import Layout from '@/components/Layout'
import Home from '@/pages/Home'

const Games = lazy(() => import('@/pages/Games'))
const GameDetail = lazy(() => import('@/pages/GameDetail'))
const Admin = lazy(() => import('@/pages/Admin'))

function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Home />} />
        <Route element={
          <Suspense fallback={
            <div role="status" className="container-custom py-20 text-center text-gray-500">
              正在加载页面...
            </div>
          }>
            <Outlet />
          </Suspense>
        }>
          <Route path="games" element={<Games />} />
          <Route path="games/:id" element={<GameDetail />} />
          <Route path="admin" element={<Admin />} />
        </Route>
      </Route>
    </Routes>
  )
}

export default App
