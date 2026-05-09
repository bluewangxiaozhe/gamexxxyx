import { motion } from 'framer-motion'
import { Loader2, Gamepad2, SearchX, Plus } from 'lucide-react'
import GameCard from './GameCard'
import type { Game } from '@/types'
import { useState } from 'react'

interface GameGridProps {
  games: Game[]
  loading?: boolean
  error?: string | null
}

export default function GameGrid({ games, loading, error }: GameGridProps) {
  // 手机端初始 3 个，桌面端初始 6 个
  const [displayCount, setDisplayCount] = useState(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 640) {
      return 3
    }
    return 6
  })
  const displayedGames = games.slice(0, displayCount)
  const hasMore = games.length > displayCount
  
  // 手机端每次加载 3 个，桌面端每次加载 6 个
  const loadMoreCount = typeof window !== 'undefined' && window.innerWidth < 640 ? 3 : 6
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        >
          <Loader2 className="w-10 h-10 text-primary-500" />
        </motion.div>
        <p className="mt-4 text-gray-500">加载游戏中...</p>
      </div>
    )
  }

  if (error) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center justify-center py-20"
      >
        <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mb-4">
          <SearchX className="w-10 h-10 text-red-400" />
        </div>
        <p className="text-red-500 font-medium">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 px-4 py-2 bg-primary-50 text-primary-600 rounded-lg hover:bg-primary-100 transition-colors"
        >
          刷新重试
        </button>
      </motion.div>
    )
  }

  if (games.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center justify-center py-20"
      >
        <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-4">
          <Gamepad2 className="w-10 h-10 text-gray-300" />
        </div>
        <p className="text-gray-500 font-medium">暂无游戏</p>
        <p className="text-sm text-gray-400 mt-1">试试其他分类或搜索关键词</p>
      </motion.div>
    )
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
      >
        {displayedGames.map((game, index) => (
          <GameCard key={game.id} game={game} index={index} />
        ))}
      </motion.div>

      {hasMore && (
        <div className="mt-10 text-center">
          <button
            onClick={() => setDisplayCount(prev => prev + loadMoreCount)}
            className="inline-flex items-center gap-2 px-8 py-3 bg-white border border-gray-200 rounded-2xl font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm"
          >
            <Plus className="w-4 h-4" />
            加载更多 ({games.length - displayCount}个)
          </button>
        </div>
      )}
    </>
  )
}
