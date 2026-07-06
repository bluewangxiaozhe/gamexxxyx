import { motion, AnimatePresence } from 'framer-motion'
import { ArrowRight, Download, Sparkles, Search, ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { useState, useEffect, useCallback } from 'react'
import type { Game, HeroBanner } from '@/types'
import { useHeroBanners } from '@/hooks/useGames'

interface Announcement {
  id: number
  title: string
  content: string
  link?: string
  visible: boolean
}

const defaultAnnouncements: Announcement[] = [
  {
    id: 1,
    title: '欢迎来到小小小游戏',
    content: '每天更新精品游戏，享受畅快体验',
    visible: true,
  },
]

function loadAnnouncements(): Announcement[] {
  try {
    const saved = localStorage.getItem('announcements')
    if (saved) {
      const parsed = JSON.parse(saved)
      if (Array.isArray(parsed)) {
        return parsed.filter((a: Announcement) => a.visible)
      }
    }
  } catch (e) { /* ignore */ }
  return defaultAnnouncements.filter(a => a.visible)
}

const defaultBanners: HeroBanner[] = [
  {
    id: 1,
    title: '复古传奇',
    subtitle: '经典再现，热血重燃',
    desc: '原汁原味的传奇体验，战法道三职业，沙巴克攻城等你来战',
    image: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=1600&h=900&fit=crop',
    color: 'from-amber-500 to-orange-600',
    bgColor: 'bg-amber-50',
    sortOrder: 0,
    visible: true,
  },
  {
    id: 2,
    title: '沉默专属',
    subtitle: '独家版本，专属神器',
    desc: '全新沉默版本，专属装备系统，打造属于你的传奇之路',
    image: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=1600&h=900&fit=crop',
    color: 'from-purple-500 to-indigo-600',
    bgColor: 'bg-purple-50',
    sortOrder: 1,
    visible: true,
  },
  {
    id: 3,
    title: '单职业超变',
    subtitle: '一刀999，爽到飞起',
    desc: '单职业超变版本，超高爆率，装备全靠打，散人也能当大佬',
    image: 'https://images.unsplash.com/photo-1538481199705-c710c4e965fc?w=1600&h=900&fit=crop',
    color: 'from-red-500 to-pink-600',
    bgColor: 'bg-red-50',
    sortOrder: 2,
    visible: true,
  },
]

function deriveGameBanners(games: Game[]): HeroBanner[] {
  return games
    .filter(game => game.status === 'active' && game.banner)
    .sort((a, b) => (b.heat || 0) - (a.heat || 0))
    .map((game, index) => ({
      id: game.id || index + 1,
      title: game.banner?.title?.trim() || game.name,
      subtitle: game.banner?.subtitle?.trim() || game.category,
      desc: game.banner?.desc?.trim() || game.description,
      image: game.banner?.image?.trim() || game.imageUrl,
      color: game.banner?.color?.trim() || 'from-amber-500 to-orange-600',
      bgColor: game.banner?.bgColor?.trim() || 'bg-amber-50',
      sortOrder: index,
      visible: true,
    }))
    .filter(banner => banner.title || banner.image)
}

interface HeroProps {
  games: Game[]
}

export default function Hero({ games }: HeroProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [currentBanner, setCurrentBanner] = useState(0)
  const [announcements] = useState<Announcement[]>(loadAnnouncements)
  const [currentAnnouncement, setCurrentAnnouncement] = useState(0)
  const [announcementVisible, setAnnouncementVisible] = useState(true) // 公告可见状态
  const { heroBanners } = useHeroBanners()
  const navigate = useNavigate()

  const gameBanners = deriveGameBanners(games)
  const banners = heroBanners.length > 0 ? heroBanners : (gameBanners.length > 0 ? gameBanners : defaultBanners)

  const nextBanner = useCallback(() => {
    setCurrentBanner((prev) => (prev + 1) % banners.length)
  }, [banners.length])

  const prevBanner = useCallback(() => {
    setCurrentBanner((prev) => (prev - 1 + banners.length) % banners.length)
  }, [banners.length])

  // 公告自动隐藏（45秒后渐变消失）
  useEffect(() => {
    if (announcements.length === 0) return
    const timer = setTimeout(() => {
      setAnnouncementVisible(false)
    }, 45000) // 45秒后自动隐藏
    return () => clearTimeout(timer)
  }, [announcements.length])

  // 公告自动滚动
  useEffect(() => {
    if (announcements.length <= 1) return
    const timer = setInterval(() => {
      setCurrentAnnouncement((prev) => (prev + 1) % announcements.length)
    }, 4000)
    return () => clearInterval(timer)
  }, [announcements.length])

  useEffect(() => {
    const timer = setInterval(nextBanner, 5000)
    return () => clearInterval(timer)
  }, [nextBanner])

  useEffect(() => {
    if (currentBanner >= banners.length) {
      setCurrentBanner(0)
    }
  }, [banners.length, currentBanner])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      navigate(`/games?search=${encodeURIComponent(searchQuery.trim())}`)
    }
  }

  const banner = banners[currentBanner]

  return (
    <section className="relative overflow-hidden min-h-[85vh] flex items-center pt-8">
      {/* 滚动公告栏 - 弱化背景 + 自动隐藏 */}
      <AnimatePresence>
        {announcements.length > 0 && (
          <motion.div
            initial={{ opacity: 1, height: 'auto' }}
            animate={{ opacity: announcementVisible ? 1 : 0, height: announcementVisible ? 'auto' : 0 }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.8, ease: 'easeInOut' }}
            className="absolute top-0 left-0 right-0 z-50 overflow-hidden"
          >
            <div className="bg-white/80 backdrop-blur-md border-b border-gray-200/50">
              <div className="max-w-7xl mx-auto px-4">
                <div className="flex items-center justify-center gap-2 py-2 text-sm">
                  <motion.div
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="w-2 h-2 bg-amber-500 rounded-full"
                  />
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={`${announcements[currentAnnouncement].id}-${currentAnnouncement}`}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      transition={{ duration: 0.5 }}
                      className="flex items-center gap-2 text-gray-700"
                    >
                      <span className="font-medium text-amber-700">{announcements[currentAnnouncement].title}:</span>
                      <span className="text-gray-600">{announcements[currentAnnouncement].content}</span>
                      {announcements[currentAnnouncement].link && (
                        <a
                          href={announcements[currentAnnouncement].link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-amber-600 hover:text-amber-800 hover:underline"
                        >
                          查看详情
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </motion.div>
                  </AnimatePresence>
                  {announcements.length > 1 && (
                    <div className="flex gap-1 ml-2">
                      {announcements.map((_, i) => (
                        <div
                          key={i}
                          className={`w-1.5 h-1.5 rounded-full transition-colors ${
                            i === currentAnnouncement ? 'bg-amber-500' : 'bg-gray-300'
                          }`}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 固定背景色 */}
      <div className="absolute inset-0 bg-gray-50" />

      {/* 静态装饰点 - 减少动画开销 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[20, 45, 70, 35, 60, 85].map((left, i) => (
          <div
            key={i}
            className="absolute w-2 h-2 bg-primary-200/40 rounded-full"
            style={{
              left: `${left}%`,
              top: `${15 + (i % 3) * 25}%`,
            }}
          />
        ))}
      </div>

      <div className="container-custom relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* 左侧内容 */}
          <div>
            {/* 标签 */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-white/80 backdrop-blur-sm text-gray-700 rounded-full text-sm font-medium mb-8 shadow-sm"
            >
              <Sparkles className="w-4 h-4 text-amber-500" />
              已收录 100+ 精品游戏
            </motion.div>

            {/* Banner 内容 */}
            <AnimatePresence mode="wait">
              <motion.div
                key={banner.id}
                initial={{ opacity: 0, x: -30 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 30 }}
                transition={{ duration: 0.5 }}
              >
                <div className={`inline-block px-3 py-1 rounded-lg text-sm font-bold text-white bg-gradient-to-r ${banner.color} mb-4`}>
                  {banner.subtitle}
                </div>
                <h1 className="text-5xl sm:text-6xl font-bold text-gray-900 leading-tight">
                  {banner.title}
                </h1>
                <p className="mt-6 text-lg text-gray-600 leading-relaxed max-w-lg">
                  {banner.desc}
                </p>
              </motion.div>
            </AnimatePresence>

            {/* 搜索框 */}
            <motion.form
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              onSubmit={handleSearch}
              className="mt-8 max-w-md"
            >
              <div className="relative flex items-center">
                <Search className="absolute left-4 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="搜索游戏名称..."
                  className="w-full pl-12 pr-32 py-3.5 bg-white border border-gray-200 rounded-2xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent shadow-lg shadow-gray-100/50 transition-all"
                />
                <button
                  type="submit"
                  className="absolute right-2 px-5 py-2 bg-primary-600 text-white rounded-xl font-medium hover:bg-primary-700 transition-colors"
                >
                  搜索
                </button>
              </div>
            </motion.form>

            {/* CTA */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
              className="mt-8 flex flex-wrap gap-4"
            >
              <Link to="/games" className="btn-primary gap-2 px-6 py-3">
                浏览游戏
                <motion.span
                  animate={{ x: [0, 4, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                >
                  <ArrowRight className="w-5 h-5" />
                </motion.span>
              </Link>
              <a
                href="https://oss.567zm.com/game/%E5%B0%8F%E5%B0%8F%E5%B0%8F%E6%B8%B8%E6%88%8F.exe"
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary gap-2 px-6 py-3 inline-flex items-center"
              >
                <Download className="w-5 h-5" />
                下载客户端
              </a>
            </motion.div>

            {/* Banner 切换 */}
            <div className="mt-10 flex items-center gap-4">
              <button
                onClick={prevBanner}
                className="w-10 h-10 bg-white/80 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-white transition-colors shadow-sm"
              >
                <ChevronLeft className="w-5 h-5 text-gray-600" />
              </button>
              <div className="flex gap-2">
                {banners.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentBanner(index)}
                    className={`h-2 rounded-full transition-all duration-300 ${
                      index === currentBanner ? 'w-8 bg-primary-600' : 'w-2 bg-gray-300 hover:bg-gray-400'
                    }`}
                  />
                ))}
              </div>
              <button
                onClick={nextBanner}
                className="w-10 h-10 bg-white/80 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-white transition-colors shadow-sm"
              >
                <ChevronRight className="w-5 h-5 text-gray-600" />
              </button>
            </div>
          </div>

          {/* 右侧 Banner 图 */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="hidden lg:block"
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={banner.id}
                initial={{ opacity: 0, scale: 0.95, rotateY: -10 }}
                animate={{ opacity: 1, scale: 1, rotateY: 0 }}
                exit={{ opacity: 0, scale: 0.95, rotateY: 10 }}
                transition={{ duration: 0.6 }}
                className="relative"
              >
                <div className="aspect-video rounded-3xl overflow-hidden shadow-2xl relative">
                  <img
                    src={banner.image}
                    alt={banner.title}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      // 图片加载失败时显示渐变占位
                      const target = e.target as HTMLImageElement
                      target.style.display = 'none'
                      target.parentElement!.classList.add('bg-gradient-to-br', ...banner.color.split(' '))
                    }}
                  />
                </div>
                {/* 装饰卡片 */}
                <motion.div
                  animate={{ y: [0, -10, 0] }}
                  transition={{ duration: 3, repeat: Infinity }}
                  className="absolute -bottom-6 -left-6 w-32 h-20 bg-white rounded-xl shadow-lg flex items-center justify-center"
                >
                  <div className="text-center">
                    <div className="text-2xl font-bold text-primary-600">100+</div>
                    <div className="text-xs text-gray-500">精品游戏</div>
                  </div>
                </motion.div>
                <motion.div
                  animate={{ y: [0, 10, 0] }}
                  transition={{ duration: 4, repeat: Infinity, delay: 1 }}
                  className="absolute -top-4 -right-4 w-28 h-16 bg-white rounded-xl shadow-lg flex items-center justify-center"
                >
                  <div className="text-center">
                    <div className="text-xl font-bold text-green-600">小小小</div>
                    <div className="text-xs text-gray-500">小小小游戏</div>
                  </div>
                </motion.div>
              </motion.div>
            </AnimatePresence>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
