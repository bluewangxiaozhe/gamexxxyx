import { motion } from 'framer-motion'
import { Star, Download, ArrowUpRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { Game } from '@/types'
import { useRegion } from '@/hooks/useRegion'
import { toRegionUrl } from '@/utils/region'

interface GameCardProps {
  game: Game
  index?: number
}

export default function GameCard({ game, index = 0 }: GameCardProps) {
  const region = useRegion()
  const imageUrl = toRegionUrl(game.imageUrl, region)
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.08 }}
      whileHover={{ y: -8 }}
    >
      <Link to={`/games/${game.id}`} className="group block">
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm hover:shadow-xl transition-all duration-500">
          <div className="aspect-video bg-gray-100 relative overflow-hidden">
            {game.imageUrl ? (
              <>
                <img
                  src={imageUrl}
                  alt={game.name}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
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

            {/* 分类标签 */}
            <div className="absolute top-3 left-3">
              <span className="px-3 py-1 bg-black/50 backdrop-blur-sm text-white text-xs rounded-full">
                {game.category}
              </span>
            </div>
          </div>

          <div className="p-5">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-bold text-gray-900 group-hover:text-primary-600 transition-colors duration-300">
                {game.name}
              </h3>
              <div className="flex items-center gap-1 text-amber-500 bg-amber-50 px-2 py-1 rounded-lg">
                <Star className="w-3.5 h-3.5 fill-current" />
                <span className="text-sm font-bold">{game.rating}</span>
              </div>
            </div>

            <p className="mt-3 text-sm text-gray-500 line-clamp-2 leading-relaxed">
              {game.description}
            </p>

            <div className="mt-4 flex items-center justify-between text-sm">
              <div className="flex items-center gap-3 text-gray-400">
                <span className="flex items-center gap-1">
                  <Download className="w-3.5 h-3.5" />
                  {game.downloads?.toLocaleString()}
                </span>
                {game.size && <span>{game.size}</span>}
              </div>
              {game.version && (
                <span className="text-xs text-gray-400 bg-gray-50 px-2 py-1 rounded">
                  v{game.version}
                </span>
              )}
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  )
}
