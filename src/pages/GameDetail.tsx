import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, Star, Download, Calendar, Tag } from 'lucide-react'
import { useGame } from '@/hooks/useGames'

export default function GameDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { game, loading, error } = useGame(Number(id))

  if (loading) {
    return (
      <div className="container-custom py-12">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/3" />
          <div className="aspect-video bg-gray-200 rounded-xl" />
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 rounded w-full" />
            <div className="h-4 bg-gray-200 rounded w-2/3" />
          </div>
        </div>
      </div>
    )
  }

  if (error || !game) {
    return (
      <div className="container-custom py-12 text-center">
        <p className="text-red-500">{error || '游戏不存在'}</p>
        <button
          onClick={() => navigate('/games')}
          className="mt-4 btn-secondary"
        >
          返回游戏库
        </button>
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="py-12"
    >
      <div className="container-custom">
        <button
          onClick={() => navigate('/games')}
          className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          返回游戏库
        </button>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2">
            <div className="aspect-video bg-gray-100 rounded-xl overflow-hidden">
              {game.imageUrl ? (
                <img
                  src={game.imageUrl}
                  alt={game.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-400">
                  暂无图片
                </div>
              )}
            </div>

            <div className="mt-8">
              <h1 className="text-3xl font-bold text-gray-900">{game.name}</h1>
              <p className="mt-4 text-gray-600 leading-relaxed">{game.description}</p>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <div className="bg-white rounded-xl border border-gray-100 p-6">
              <div className="flex items-center gap-2 text-amber-500 mb-4">
                <Star className="w-5 h-5 fill-current" />
                <span className="text-2xl font-bold">{game.rating}</span>
              </div>

              <a
                href={game.downloadUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary w-full gap-2"
              >
                <Download className="w-5 h-5" />
                立即下载
              </a>
            </div>

            <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-4">
              <div className="flex items-center gap-3 text-sm">
                <Tag className="w-4 h-4 text-gray-400" />
                <span className="text-gray-500">分类</span>
                <span className="ml-auto font-medium">{game.category}</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Download className="w-4 h-4 text-gray-400" />
                <span className="text-gray-500">下载量</span>
                <span className="ml-auto font-medium">{game.downloads}</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Calendar className="w-4 h-4 text-gray-400" />
                <span className="text-gray-500">版本</span>
                <span className="ml-auto font-medium">{game.version}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
