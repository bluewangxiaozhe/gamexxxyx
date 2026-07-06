import Hero from '@/components/Hero'
import CategoryNav from '@/components/CategoryNav'
import GameGrid from '@/components/GameGrid'
import Features from '@/components/Features'
import DownloadCTA from '@/components/DownloadCTA'
import { useGames } from '@/hooks/useGames'
import { Link } from 'react-router-dom'
import { ArrowRight, Flame } from 'lucide-react'

export default function Home() {
  const { games, loading, error } = useGames()

  // 排序：active(上架) > maintenance(维护) > inactive(下架)
  const statusOrder: Record<string, number> = { active: 1, maintenance: 2, inactive: 3 }
  const sortedGames = [...games].sort((a, b) => {
    const orderDiff = (statusOrder[a.status || 'inactive'] || 4) - (statusOrder[b.status || 'inactive'] || 4)
    if (orderDiff !== 0) return orderDiff

    const heatDiff = (b.heat || 0) - (a.heat || 0)
    if (heatDiff !== 0) return heatDiff

    return b.downloads - a.downloads
  })

  const hotGames = sortedGames.slice(0, 8)

  return (
    <div>
      {/* 1. Hero 首屏 + Banner 轮播 */}
      <Hero games={games} />

      {/* 2. 分类导航 */}
      <CategoryNav />

      {/* 3. 热门游戏（唯一卡片区） */}
      <section className="py-20 bg-gray-50">
        <div className="container-custom">
          <div className="flex items-center justify-between mb-10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center">
                <Flame className="w-5 h-5 text-red-500" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900">热门游戏</h2>
            </div>
            <Link
              to="/games"
              className="inline-flex items-center gap-1 text-sm font-medium text-primary-600 hover:text-primary-700"
            >
              查看全部
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <GameGrid games={hotGames} loading={loading} error={error} />
        </div>
      </section>

      {/* 4. 功能特色 */}
      <Features />

      {/* 5. Windows 客户端下载 */}
      <DownloadCTA />
    </div>
  )
}
