import { motion } from 'framer-motion'
import { Flame, ChevronRight, Loader2, ArrowUpRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useState } from 'react'
import type { Game } from '@/types'
import { useRegion } from '@/hooks/useRegion'
import { toRegionUrl } from '@/utils/region'

interface FeaturedGamesProps {
  games: Game[]
}

export default function FeaturedGames({ games }: FeaturedGamesProps) {
  const region = useRegion()
  const [displayCount, setDisplayCount] = useState(6)
  const featured = games.slice(0, displayCount)
  const hasMore = games.length > displayCount

  if (featured.length === 0) return null

  return (
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
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {featured.map((game, index) => (
            <motion.div
              key={game.id}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
            >
              <Link to={`/games/${game.id}`} className="group block">
                <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm hover:shadow-xl transition-all duration-500">
                  <div className="aspect-[16/9] bg-gray-100 relative overflow-hidden">
                    {game.imageUrl ? (
                      <>
                        <img
                          src={toRegionUrl(game.imageUrl, region)}
                          alt={game.name}
                          className="w-full h-full object-cover group-hover:scale-108 transition-transform duration-500"
                        />
                        {/* 悬停遮罩 */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent flex items-end justify-end p-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                          <div className="w-10 h-10 bg-white/90 rounded-xl flex items-center justify-center transform translate-y-2 group-hover:translate-y-0 transition-transform duration-300">
                            <ArrowUpRight className="w-5 h-5 text-primary-600" />
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400">
                        暂无图片
                      </div>
                    )}
                    <div className="absolute top-3 left-3">
                      <span className="px-3 py-1 bg-black/50 backdrop-blur-sm text-white text-xs rounded-full">
                        {game.category}
                      </span>
                    </div>
                    <div className="absolute top-3 right-3">
                      <span className="px-2 py-1 bg-red-500 text-white text-xs rounded-lg font-bold">
                        HOT
                      </span>
                    </div>
                  </div>

                  <div className="p-5">
                    <h3 className="font-bold text-gray-900 group-hover:text-primary-600 transition-colors">
                      {game.name}
                    </h3>
                    <p className="mt-2 text-sm text-gray-500 line-clamp-2">
                      {game.description}
                    </p>
                    <div className="mt-4 flex items-center justify-between">
                      <div className="flex items-center gap-3 text-sm text-gray-400">
                        <span>v{game.version}</span>
                        <span>{game.size}</span>
                      </div>
                      <span className="text-sm font-bold text-primary-600">
                        {game.downloads?.toLocaleString()} 下载
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>

        {hasMore && (
          <div className="mt-10 text-center">
            <button
              onClick={() => setDisplayCount(prev => prev + 6)}
              className="inline-flex items-center gap-2 px-8 py-3 bg-white border border-gray-200 rounded-2xl font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm"
            >
              <Loader2 className="w-4 h-4" />
              加载更多
            </button>
          </div>
        )}
      </div>
    </section>
  )
}
