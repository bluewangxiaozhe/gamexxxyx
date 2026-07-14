import Hero from '@/components/Hero'
import CategoryNav from '@/components/CategoryNav'
import GameGrid from '@/components/GameGrid'
import Features from '@/components/Features'
import DownloadCTA from '@/components/DownloadCTA'
import { useGames } from '@/hooks/useGames'
import { Link } from 'react-router-dom'
import { ArrowRight, Clock3 } from 'lucide-react'

export default function Home() {
  const { games, loading, error } = useGames()

  // 公共列表完全按添加时间排序；维护状态只影响下载操作，不改变时间顺序。
  const sortedGames = [...games].sort((a, b) => {
    const bTime = Date.parse(b.createdAt || '') || 0
    const aTime = Date.parse(a.createdAt || '') || 0
    return bTime - aTime || b.id - a.id
  })

  const latestGames = sortedGames.slice(0, 8)

  return (
    <div>
      {/* 1. Hero 首屏 + Banner 轮播 */}
      <Hero games={games} />

      {/* 2. 分类导航 */}
      <CategoryNav />

      {/* 3. 最新游戏（唯一卡片区） */}
      <section className="py-20 bg-gray-50">
        <div className="container-custom">
          <div className="flex items-center justify-between mb-10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary-50 rounded-xl flex items-center justify-center">
                <Clock3 className="w-5 h-5 text-primary-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900">最新游戏</h2>
            </div>
            <Link
              to="/games"
              className="inline-flex items-center gap-1 text-sm font-medium text-primary-600 hover:text-primary-700"
            >
              查看全部
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <GameGrid games={latestGames} loading={loading} error={error} />
        </div>
      </section>

      {/* 4. 功能特色 */}
      <Features />

      {/* 5. Windows 客户端下载 */}
      <DownloadCTA />
    </div>
  )
}
