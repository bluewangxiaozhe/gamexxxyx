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
    category: '推荐',
    title: '复古传奇',
    subtitle: '经典再现，热血重燃',
    desc: '原汁原味的传奇体验，战法道三职业，沙巴克攻城等你来战',
    image: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=1920&h=480&fit=crop',
    color: 'from-amber-500 to-orange-600',
    bgColor: 'bg-amber-50',
    sortOrder: 0,
    visible: true,
  },
  {
    id: 2,
    category: '热门',
    title: '沉默专属',
    subtitle: '独家版本，专属神器',
    desc: '全新沉默版本，专属装备系统，打造属于你的传奇之路',
    image: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=1920&h=480&fit=crop',
    color: 'from-purple-500 to-indigo-600',
    bgColor: 'bg-purple-50',
    sortOrder: 1,
    visible: true,
  },
  {
    id: 3,
    category: '上新',
    title: '单职业超变',
    subtitle: '一刀999，爽到飞起',
    desc: '单职业超变版本，超高爆率，装备全靠打，散人也能当大佬',
    image: 'https://images.unsplash.com/photo-1538481199705-c710c4e965fc?w=1920&h=480&fit=crop',
    color: 'from-red-500 to-pink-600',
    bgColor: 'bg-red-50',
    sortOrder: 2,
    visible: true,
  },
]

function normalizeLegacyHeroBanner(raw: any, fallbackSortOrder = 0): HeroBanner | null {
  if (!raw || typeof raw !== 'object') return null

  const title = String(raw.title || '').trim()
  const image = String(raw.image || '').trim()
  if (!title && !image) return null

  return {
    id: Number(raw.id) || fallbackSortOrder + 1,
    category: String(raw.category || '').trim() || '推荐',
    title,
    subtitle: String(raw.subtitle || '').trim(),
    desc: String(raw.desc || '').trim(),
    image,
    color: String(raw.color || '').trim() || 'from-amber-500 to-orange-600',
    bgColor: String(raw.bgColor || '').trim() || 'bg-amber-50',
    sortOrder: Number.isFinite(Number(raw.sortOrder)) ? Number(raw.sortOrder) : fallbackSortOrder,
    visible: raw.visible !== false,
  }
}

function loadLegacyHeroBanners(): HeroBanner[] {
  try {
    const saved = localStorage.getItem('hero_banners')
    if (!saved) return []

    const parsed = JSON.parse(saved)
    if (!Array.isArray(parsed)) return []

    return parsed
      .map((item, index) => normalizeLegacyHeroBanner(item, index))
      .filter((item): item is HeroBanner => item !== null && item.visible)
      .sort((a, b) => a.sortOrder - b.sortOrder)
  } catch {
    return []
  }
}

function deriveGameBanners(games: Game[]): HeroBanner[] {
  return games
    .filter(game => game.status === 'active' && game.banner)
    .sort((a, b) => (b.heat || 0) - (a.heat || 0))
    .map((game, index) => ({
      id: game.id || index + 1,
      category: '热门',
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
  const [legacyBanners] = useState<HeroBanner[]>(loadLegacyHeroBanners)
  const { heroBanners } = useHeroBanners()
  const navigate = useNavigate()

  const gameBanners = deriveGameBanners(games)
  const banners = heroBanners.length > 0
    ? heroBanners
    : (legacyBanners.length > 0 ? legacyBanners : (gameBanners.length > 0 ? gameBanners : defaultBanners))

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
        <AnimatePresence mode="wait">
          <motion.div
            key={banner.id}
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -24, scale: 0.98 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className="relative overflow-hidden rounded-[32px] border border-white/50 bg-slate-950 shadow-[0_30px_90px_rgba(15,23,42,0.22)]"
          >
            <div className="absolute inset-0 bg-slate-900" />
            <img
              src={banner.image}
              alt={banner.title}
              className="absolute inset-0 h-full w-full object-cover object-center"
              onError={(e) => {
                const target = e.target as HTMLImageElement
                target.style.display = 'none'
              }}
            />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.22),transparent_32%)]" />
            <div className={`absolute inset-0 bg-gradient-to-br ${banner.color} opacity-20`} />
            <div className="absolute inset-0 bg-gradient-to-r from-slate-950/88 via-slate-950/68 via-45% to-slate-950/28" />
            <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-slate-950/60 to-transparent" />

            <div className="relative z-10 flex min-h-[560px] items-end lg:min-h-[620px]">
              <div className="w-full px-6 py-8 sm:px-10 sm:py-10 lg:px-14 lg:py-14">
                <div className="max-w-2xl rounded-[28px] border border-white/15 bg-white/10 p-6 backdrop-blur-md sm:p-8 lg:p-10">
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.45 }}
                    className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/12 px-4 py-2 text-sm font-medium text-white/88 shadow-lg shadow-slate-950/15"
                  >
                    <Sparkles className="h-4 w-4 text-amber-300" />
                    已收录 100+ 精品游戏
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0, x: -30 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.5, delay: 0.05 }}
                    className="mt-6"
                  >
                    <div className={`inline-flex rounded-full bg-gradient-to-r px-3 py-1 text-sm font-bold text-white shadow-lg shadow-slate-950/20 ${banner.color}`}>
                      {banner.category || '推荐'}
                    </div>
                    <h1 className="mt-5 text-4xl font-bold leading-tight text-white drop-shadow-sm sm:text-5xl lg:text-6xl">
                      {banner.title}
                    </h1>
                    {banner.subtitle && (
                      <p className="mt-4 text-lg font-semibold text-white/92 sm:text-xl">
                        {banner.subtitle}
                      </p>
                    )}
                    <p className="mt-5 max-w-xl text-base leading-8 text-white/78 sm:text-lg">
                      {banner.desc}
                    </p>
                  </motion.div>

                  <motion.form
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.12 }}
                    onSubmit={handleSearch}
                    className="mt-8 max-w-lg"
                  >
                    <div className="relative flex items-center rounded-2xl border border-white/20 bg-white/92 p-2 shadow-xl shadow-slate-950/15">
                      <Search className="absolute left-5 h-5 w-5 text-slate-400" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="搜索游戏名称..."
                        className="w-full bg-transparent py-3 pl-12 pr-32 text-gray-900 placeholder-gray-400 focus:outline-none"
                      />
                      <button
                        type="submit"
                        className="absolute right-2 rounded-xl bg-primary-600 px-5 py-3 font-medium text-white transition-colors hover:bg-primary-700"
                      >
                        搜索
                      </button>
                    </div>
                  </motion.form>

                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.2 }}
                    className="mt-8 flex flex-wrap gap-4"
                  >
                    <Link to="/games" className="btn-primary gap-2 px-6 py-3">
                      浏览游戏
                      <motion.span
                        animate={{ x: [0, 4, 0] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                      >
                        <ArrowRight className="h-5 w-5" />
                      </motion.span>
                    </Link>
                    <a
                      href="https://oss.567zm.com/game/%E5%B0%8F%E5%B0%8F%E5%B0%8F%E6%B8%B8%E6%88%8F.exe"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-6 py-3 font-medium text-white backdrop-blur-sm transition-colors hover:bg-white/18"
                    >
                      <Download className="h-5 w-5" />
                      下载客户端
                    </a>
                  </motion.div>

                  <div className="mt-10 flex flex-wrap items-center gap-4">
                    <button
                      onClick={prevBanner}
                      className="flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white transition-colors hover:bg-white/18"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </button>
                    <div className="flex gap-2">
                      {banners.map((_, index) => (
                        <button
                          key={index}
                          onClick={() => setCurrentBanner(index)}
                          className={`h-2 rounded-full transition-all duration-300 ${
                            index === currentBanner ? 'w-10 bg-white' : 'w-2 bg-white/35 hover:bg-white/55'
                          }`}
                        />
                      ))}
                    </div>
                    <button
                      onClick={nextBanner}
                      className="flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white transition-colors hover:bg-white/18"
                    >
                      <ChevronRight className="h-5 w-5" />
                    </button>
                    <div className="ml-auto hidden rounded-2xl border border-white/15 bg-slate-950/28 px-5 py-3 text-right text-white/82 backdrop-blur-sm lg:block">
                      <div className="text-xs uppercase tracking-[0.3em] text-white/48">Hero Banner</div>
                      <div className="mt-1 text-sm">官网与客户端共用素材</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  )
}
