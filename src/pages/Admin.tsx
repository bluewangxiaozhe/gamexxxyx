
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Lock, LogIn, Plus, Edit2, Trash2, Save, X, Gamepad2, Download, Tag, Image, ChevronLeft, Bell, ExternalLink } from 'lucide-react'
import { useGames } from '@/hooks/useGames'
import { api, setAdminToken, clearAdminToken, getAdminToken } from '@/utils/api'
import type { Game, GameBanner, HeroBanner } from '@/types'
import UppyUploader from '@/components/UppyUploader'

function createEmptyHeroBanner(sortOrder = 0): HeroBanner {
  return {
    id: 0,
    category: '推荐',
    title: '',
    subtitle: '',
    desc: '',
    image: '',
    color: 'from-amber-500 to-orange-600',
    bgColor: 'bg-amber-50',
    sortOrder,
    visible: true,
  }
}

function normalizeLegacyHeroBanner(raw: any, fallbackSortOrder = 0): HeroBanner | null {
  if (!raw || typeof raw !== 'object') return null

  const title = String(raw.title || '').trim()
  const image = String(raw.image || '').trim()
  if (!title && !image) return null

  return {
    id: Number(raw.id) || Date.now() + fallbackSortOrder,
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
      .filter((item): item is HeroBanner => item !== null)
      .sort((a, b) => a.sortOrder - b.sortOrder)
  } catch {
    return []
  }
}

// 公告管理
interface AnnouncementConfig {
  id: number
  title: string
  content: string
  link?: string
  visible: boolean
}

const defaultAnnouncements: AnnouncementConfig[] = [
  {
    id: 1,
    title: '欢迎来到小小小游戏',
    content: '每天更新精品游戏，享受畅快体验',
    visible: true,
  },
]

function loadAnnouncements(): AnnouncementConfig[] {
  try {
    const saved = localStorage.getItem('announcements')
    if (saved) {
      const parsed = JSON.parse(saved)
      if (Array.isArray(parsed) && parsed.length > 0) return parsed
    }
  } catch { /* ignore */ }
  return defaultAnnouncements
}

function saveAnnouncements(announcements: AnnouncementConfig[]) {
  localStorage.setItem('announcements', JSON.stringify(announcements))
}

const CATEGORY_OPTIONS = ['单职业', '复古', '微变', '超变', '合击', '沉默', '专属']
const HERO_BANNER_CATEGORY_OPTIONS = ['推荐', '预告', '热门', '上新', '测试']

interface GameForm {
  name: string
  category: string
  description: string
  version: string
  size: string
  openTime: string
  heat: number
  downloadUrl: string
  guideUrl: string
  dropRateUrl: string
  imageUrl: string
  bannerTitle: string
  bannerSubtitle: string
  bannerDesc: string
  bannerImage: string
  bannerColor: string
  bannerBgColor: string
  rating: number
  downloads: number
  status: 'active' | 'inactive' | 'maintenance'
  tags: string
}

interface FileData {
  url: string
  filename?: string
  size?: number
}

function formatSizeForDisplay(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

function getNameFromFilename(filename: string): string {
  const nameWithoutExt = filename.replace(/\.[^/.]+$/, '')
  return nameWithoutExt.replace(/[-_]+/g, ' ').trim()
}

function toBannerOrNull(form: GameForm): GameBanner | null {
  const banner = {
    title: form.bannerTitle.trim(),
    subtitle: form.bannerSubtitle.trim(),
    desc: form.bannerDesc.trim(),
    image: form.bannerImage.trim(),
    color: form.bannerColor.trim(),
    bgColor: form.bannerBgColor.trim(),
  }

  if (!banner.title && !banner.subtitle && !banner.desc && !banner.image) {
    return null
  }

  return banner
}

function createEmptyForm(): GameForm {
  return {
    name: '',
    category: CATEGORY_OPTIONS[0],
    description: '',
    version: '1.0.0',
    size: '',
    openTime: '',
    heat: 0,
    downloadUrl: '',
    guideUrl: '',
    dropRateUrl: '',
    imageUrl: '',
    bannerTitle: '',
    bannerSubtitle: '',
    bannerDesc: '',
    bannerImage: '',
    bannerColor: 'from-amber-500 to-orange-600',
    bannerBgColor: 'bg-amber-50',
    rating: 5.0,
    downloads: 100,
    status: 'active',
    tags: '',
  }
}

function gameToForm(game: Game): GameForm {
  return {
    name: game.name,
    category: game.category,
    description: game.description,
    version: game.version,
    size: game.size,
    openTime: game.openTime || '',
    heat: game.heat || 0,
    downloadUrl: game.downloadUrl,
    guideUrl: game.guideUrl || '',
    dropRateUrl: game.dropRateUrl || '',
    imageUrl: game.imageUrl,
    bannerTitle: game.banner?.title || '',
    bannerSubtitle: game.banner?.subtitle || '',
    bannerDesc: game.banner?.desc || '',
    bannerImage: game.banner?.image || '',
    bannerColor: game.banner?.color || 'from-amber-500 to-orange-600',
    bannerBgColor: game.banner?.bgColor || 'bg-amber-50',
    rating: game.rating,
    downloads: game.downloads,
    status: game.status || 'active',
    tags: Array.isArray(game.tags) ? game.tags.join(', ') : (game.tags || ''),
  }
}

function formToGame(form: GameForm): Omit<Game, 'id' | 'addedAt'> {
  return {
    name: form.name.trim(),
    category: form.category,
    description: form.description.trim(),
    version: form.version.trim(),
    size: form.size.trim(),
    openTime: form.openTime.trim(),
    heat: Number(form.heat) || 0,
    downloadUrl: form.downloadUrl.trim(),
    guideUrl: form.guideUrl.trim(),
    dropRateUrl: form.dropRateUrl.trim(),
    imageUrl: form.imageUrl.trim(),
    banner: toBannerOrNull(form),
    rating: Number(form.rating) || 0,
    downloads: Number(form.downloads) || 0,
    status: form.status,
    tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
  }
}

export default function Admin() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => getAdminToken() !== '')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loggingIn, setLoggingIn] = useState(false)
  const { games, loading, refetch } = useGames()

  const statusOrder: Record<string, number> = { active: 1, maintenance: 2, inactive: 3 }
  const sortedGames = [...games].sort((a, b) => {
    const orderDiff = (statusOrder[a.status || 'inactive'] || 4) - (statusOrder[b.status || 'inactive'] || 4)
    return orderDiff !== 0 ? orderDiff : 0
  })

  const [editingGame, setEditingGame] = useState<Game | null>(null)
  const [form, setForm] = useState<GameForm>(createEmptyForm())
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [showGameForm, setShowGameForm] = useState(false)

  const [banners, setBanners] = useState<HeroBanner[]>([])
  const [bannerTab, setBannerTab] = useState(false)
  const [editingBanner, setEditingBanner] = useState<HeroBanner | null>(null)
  const [bannerForm, setBannerForm] = useState<HeroBanner>(createEmptyHeroBanner())
  const [bannerMessage, setBannerMessage] = useState('')
  const [bannerLoading, setBannerLoading] = useState(false)
  const [showBannerForm, setShowBannerForm] = useState(false)

  // 公告管理状态
  const [announcements, setAnnouncements] = useState<AnnouncementConfig[]>(loadAnnouncements)
  const [announcementTab, setAnnouncementTab] = useState(false)
  const [editingAnnouncement, setEditingAnnouncement] = useState<AnnouncementConfig | null>(null)
  const [announcementForm, setAnnouncementForm] = useState<AnnouncementConfig>({ id: 0, title: '', content: '', link: '', visible: true })
  const [announcementMessage, setAnnouncementMessage] = useState('')

  // 自定义确认对话框状态
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean
    title: string
    message: string
    onConfirm: () => void
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {} })

  const showConfirm = (title: string, message: string, onConfirm: () => void) => {
    setConfirmDialog({ isOpen: true, title, message, onConfirm })
  }

  const handleConfirm = () => {
    confirmDialog.onConfirm()
    setConfirmDialog({ isOpen: false, title: '', message: '', onConfirm: () => {} })
  }

  const handleCancelConfirm = () => {
    setConfirmDialog({ isOpen: false, title: '', message: '', onConfirm: () => {} })
  }

  const fetchHeroBanners = async () => {
    setBannerLoading(true)
    const response = await api.getHeroBanners(true)
    if (response.success && response.data) {
      const legacyBanners = loadLegacyHeroBanners()
      if (response.data.length > 0) {
        setBanners(response.data)
        setBannerMessage('')
      } else if (legacyBanners.length > 0) {
        setBanners(legacyBanners)
        setBannerMessage('检测到旧版本地 Banner 数据。当前先恢复显示，保存后会迁移到服务端。')
      } else {
        setBanners([])
        setBannerMessage('')
      }
    } else {
      setBannerMessage(response.message || '获取 Banner 失败')
    }
    setBannerLoading(false)
  }

  useEffect(() => {
    if (!isAuthenticated) return
    void fetchHeroBanners()
  }, [isAuthenticated])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!password) {
      setError('请输入密码')
      return
    }
    setLoggingIn(true)
    setError('')
    try {
      const ok = await api.checkAuth(password)
      if (ok) {
        setAdminToken(password)
        setIsAuthenticated(true)
        setPassword('')
      } else {
        setError('密码错误')
      }
    } catch {
      setError('登录失败，请检查网络')
    } finally {
      setLoggingIn(false)
    }
  }

  const handleLogout = () => {
    clearAdminToken()
    setIsAuthenticated(false)
    setPassword('')
    setBanners([])
  }

  const openEdit = (game: Game) => {
    setBannerTab(false)
    setAnnouncementTab(false)
    setEditingGame(game)
    setForm(gameToForm(game))
    setShowGameForm(true)
    setMessage('')
  }

  const closeGameForm = () => {
    setShowGameForm(false)
    setEditingGame(null)
    setForm(createEmptyForm())
    setMessage('')
  }

  const openAddBanner = () => {
    setEditingBanner(null)
    setBannerForm(createEmptyHeroBanner(banners.length))
    setBannerMessage('')
    setShowBannerForm(true)
  }

  const openEditBanner = (banner: HeroBanner) => {
    setEditingBanner(banner)
    setBannerForm({ ...banner })
    setBannerMessage('')
    setShowBannerForm(true)
  }

  const handleSaveBanner = async () => {
    if (!bannerForm.title.trim() || !bannerForm.image.trim()) {
      setBannerMessage('请填写标题和图片地址')
      return
    }

    setBannerLoading(true)
    const payload = {
      category: bannerForm.category.trim() || '推荐',
      title: bannerForm.title.trim(),
      subtitle: bannerForm.subtitle.trim(),
      desc: bannerForm.desc.trim(),
      image: bannerForm.image.trim(),
      color: bannerForm.color.trim(),
      bgColor: bannerForm.bgColor.trim(),
      sortOrder: bannerForm.sortOrder,
      visible: bannerForm.visible,
    }

    const response = editingBanner
      ? await api.updateHeroBanner(editingBanner.id, payload)
      : await api.createHeroBanner(payload)

    if (response.success) {
      await fetchHeroBanners()
      setBannerMessage('保存成功，官网与客户端将共用这组 Banner')
      setEditingBanner(null)
      setBannerForm(createEmptyHeroBanner(banners.length))
      setShowBannerForm(false)
    } else {
      setBannerMessage(response.message || '保存 Banner 失败')
    }
    setBannerLoading(false)
  }

  const handleDeleteBanner = (id: number) => {
    showConfirm('删除 Banner', '确定删除这个 Banner 吗？此操作不可恢复。', async () => {
      const response = await api.deleteHeroBanner(id)
      if (response.success) {
        await fetchHeroBanners()
        setBannerMessage('删除成功')
      } else {
        setBannerMessage(response.message || '删除 Banner 失败')
      }
    })
  }

  const handleMoveBanner = async (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return
    if (direction === 'down' && index === banners.length - 1) return
    const newBanners = [...banners]
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    ;[newBanners[index], newBanners[targetIndex]] = [newBanners[targetIndex], newBanners[index]]
    const reordered = newBanners.map((banner, order) => ({ ...banner, sortOrder: order }))
    setBanners(reordered)
    setBannerLoading(true)
    const responses = await Promise.all(
      reordered.map(banner =>
        api.updateHeroBanner(banner.id, {
          category: banner.category,
          title: banner.title,
          subtitle: banner.subtitle,
          desc: banner.desc,
          image: banner.image,
          color: banner.color,
          bgColor: banner.bgColor,
          sortOrder: banner.sortOrder,
          visible: banner.visible,
        }),
      ),
    )
    if (responses.every(response => response.success)) {
      setBannerMessage('排序已更新')
      await fetchHeroBanners()
    } else {
      setBannerMessage('排序保存失败，请重试')
    }
    setBannerLoading(false)
  }

  // 公告管理函数
  const openAddAnnouncement = () => {
    setEditingAnnouncement(null)
    setAnnouncementForm({ id: Date.now(), title: '', content: '', link: '', visible: true })
    setAnnouncementMessage('')
  }

  const openEditAnnouncement = (announcement: AnnouncementConfig) => {
    setEditingAnnouncement(announcement)
    setAnnouncementForm({ ...announcement })
    setAnnouncementMessage('')
  }

  const handleSaveAnnouncement = () => {
    if (!announcementForm.title.trim() || !announcementForm.content.trim()) {
      setAnnouncementMessage('请填写标题和内容')
      return
    }
    const newAnnouncements = editingAnnouncement
      ? announcements.map(a => a.id === editingAnnouncement.id ? { ...announcementForm } : a)
      : [...announcements, { ...announcementForm, id: Date.now() }]
    setAnnouncements(newAnnouncements)
    saveAnnouncements(newAnnouncements)
    setAnnouncementMessage('保存成功！刷新首页生效')
    setEditingAnnouncement(null)
  }

  const handleDeleteAnnouncement = (id: number) => {
    showConfirm('删除公告', '确定删除这条公告吗？此操作不可恢复。', () => {
      const newAnnouncements = announcements.filter(a => a.id !== id)
      setAnnouncements(newAnnouncements)
      saveAnnouncements(newAnnouncements)
    })
  }

  const handleToggleAnnouncement = (announcement: AnnouncementConfig) => {
    const updated = { ...announcement, visible: !announcement.visible }
    const newAnnouncements = announcements.map(a => a.id === announcement.id ? updated : a)
    setAnnouncements(newAnnouncements)
    saveAnnouncements(newAnnouncements)
  }

  const handleGameFileUpload = (data: FileData) => {
    const newForm: GameForm = { 
      ...form, 
      downloadUrl: data.url 
    }
    
    if (!form.name.trim() && data.filename) {
      newForm.name = getNameFromFilename(data.filename)
    }
    
    if (!form.size.trim() && data.size) {
      newForm.size = formatSizeForDisplay(data.size)
    }
    
    setForm(newForm)
  }

  const handleCoverUpload = (data: FileData) => {
    setForm({ ...form, imageUrl: data.url })
  }

  const handleSave = async () => {
    if (!form.name.trim()) {
      setMessage('请输入游戏名称')
      return
    }
    if (!form.downloadUrl.trim()) {
      setMessage('请输入下载地址')
      return
    }

    setSaving(true)
    setMessage('')

    try {
      const gameData = formToGame(form)
      let response

      if (editingGame) {
        response = await api.updateGame(editingGame.id, gameData)
      } else {
        response = await api.createGame(gameData as Omit<Game, 'id'>)
      }

      if (response.success) {
        setMessage(editingGame ? '修改成功！' : '添加成功！')
        await refetch()
        setTimeout(() => closeGameForm(), 800)
      } else {
        setMessage(response.message || '保存失败')
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (game: Game) => {
    showConfirm('删除游戏', `确定要删除「${game.name}」吗？此操作不可恢复。`, async () => {
      const response = await api.deleteGame(game.id)
      if (response.success) {
        await refetch()
      } else {
        alert(response.message || '删除失败')
      }
    })
  }

  const exportJSON = () => {
    const dataStr = JSON.stringify(games, null, 2)
    const blob = new Blob([dataStr], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'games.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          <div className="bg-white rounded-xl border border-gray-100 p-8">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-50 rounded-xl mb-4">
                <Lock className="w-6 h-6 text-blue-600" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900">管理后台</h1>
              <p className="mt-2 text-gray-500">请输入密码继续</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="请输入密码"
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              {error && (
                <p className="text-sm text-red-500">{error}</p>
              )}
              <button
                type="submit"
                disabled={loggingIn}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                <LogIn className="w-4 h-4" />
                {loggingIn ? '登录中...' : '登录'}
              </button>
            </form>
          </div>
        </motion.div>
      </div>
    )
  }

  const totalGames = games.length
  const totalDownloads = games.reduce((sum, g) => sum + g.downloads, 0)
  const activeGames = games.filter(g => g.status === 'active').length

  return (
    <div className="py-12">
      {/* 自定义确认对话框 */}
      {confirmDialog.isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl"
          >
            <h3 className="text-lg font-bold text-gray-900 mb-2">{confirmDialog.title}</h3>
            <p className="text-gray-600 mb-6">{confirmDialog.message}</p>
            <div className="flex gap-3">
              <button
                onClick={handleCancelConfirm}
                className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors font-medium text-gray-700"
              >
                取消
              </button>
              <button
                onClick={handleConfirm}
                className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors font-medium"
              >
                确认删除
              </button>
            </div>
          </motion.div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-10">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">管理后台</h1>
            <p className="text-gray-500 mt-1">管理游戏列表，数据实时同步到数据库</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={exportJSON}
              className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Download className="w-4 h-4" />
              导出JSON
            </button>
            <button
              onClick={() => { setShowGameForm(!showGameForm); setEditingGame(null); setForm(createEmptyForm()); setMessage(''); }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${showGameForm && !editingGame ? 'bg-blue-700 text-white' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
            >
              <Plus className="w-4 h-4" />
              {showGameForm && !editingGame ? '取消添加' : '添加游戏'}
            </button>
            <button
              onClick={() => { setBannerTab(!bannerTab); setAnnouncementTab(false); }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${bannerTab ? 'bg-amber-600 text-white' : 'border border-gray-200 hover:bg-gray-50'}`}
            >
              <Image className="w-4 h-4" />
              {bannerTab ? '返回游戏' : 'Banner管理'}
            </button>
            <button
              onClick={() => { setAnnouncementTab(!announcementTab); setBannerTab(false); }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${announcementTab ? 'bg-orange-600 text-white' : 'border border-gray-200 hover:bg-gray-50'}`}
            >
              <Bell className="w-4 h-4" />
              {announcementTab ? '返回游戏' : '公告管理'}
            </button>
            <button
              onClick={handleLogout}
              className="px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              退出
            </button>
          </div>
        </div>

        {/* Banner 管理面板 */}
        {bannerTab && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-900">首页 Banner 管理</h2>
                <p className="text-sm text-gray-500 mt-1">这里的数据会同步供官网首页和客户端 Banner 共用</p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => void fetchHeroBanners()}
                  className="px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  刷新
                </button>
                <button
                  onClick={openAddBanner}
                  className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  添加 Banner
                </button>
              </div>
            </div>

            {bannerMessage && (
              <div className={`p-3 rounded-lg text-sm ${bannerMessage.includes('成功') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                {bannerMessage}
              </div>
            )}

            {!showBannerForm && (
              <div className="text-sm text-gray-500">
                点击右上角“添加 Banner”或列表里的编辑按钮后，会在这里展开编辑表单。
              </div>
            )}

            {/* Banner 列表 */}
            <div className="grid gap-4">
              {bannerLoading && banners.length === 0 && (
                <div className="bg-white rounded-xl border border-gray-100 p-6 text-sm text-gray-500">
                  正在加载 Banner 数据...
                </div>
              )}
              {!bannerLoading && banners.length === 0 && (
                <div className="bg-white rounded-xl border border-dashed border-gray-200 p-6 text-sm text-gray-500">
                  还没有 Banner，添加后官网首页和客户端会共用这里的数据。
                </div>
              )}
              {banners.map((banner, index) => (
                <motion.div
                  key={banner.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="bg-white rounded-xl border border-gray-100 overflow-hidden"
                >
                  <div className="flex flex-col sm:flex-row">
                    <div className="sm:w-48 h-32 sm:h-auto flex-shrink-0">
                      <img src={banner.image} alt={banner.title} className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-bold text-gray-900">{banner.title}</h3>
                            <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">
                              {banner.category || '推荐'}
                            </span>
                            <span className={`text-[11px] px-2 py-0.5 rounded-full ${banner.visible ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                              {banner.visible ? '显示中' : '已隐藏'}
                            </span>
                            <span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                              排序 #{banner.sortOrder + 1}
                            </span>
                          </div>
                          <p className="text-sm text-gray-500 mt-1">{banner.subtitle}</p>
                          <p className="text-xs text-gray-400 mt-1 line-clamp-2">{banner.desc}</p>
                          <p className="text-xs text-gray-400 mt-2 break-all">{banner.image}</p>
                        </div>
                        <div className="flex flex-col gap-1 flex-shrink-0">
                          <button
                            onClick={() => void handleMoveBanner(index, 'up')}
                            disabled={index === 0 || bannerLoading}
                            className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30 transition-colors"
                          >
                            <ChevronLeft className="w-4 h-4 rotate-90" />
                          </button>
                          <button
                            onClick={() => openEditBanner(banner)}
                            className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-600 transition-colors"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteBanner(banner.id)}
                            className="p-1.5 rounded-lg hover:bg-red-50 text-red-600 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => void handleMoveBanner(index, 'down')}
                            disabled={index === banners.length - 1 || bannerLoading}
                            className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30 transition-colors"
                          >
                            <ChevronLeft className="w-4 h-4 -rotate-90" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Banner 编辑表单 */}
            {showBannerForm && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-xl border border-gray-100 p-6"
              >
                <h3 className="text-lg font-bold text-gray-900 mb-4">
                  {editingBanner ? '编辑 Banner' : '添加 Banner'}
                </h3>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">分类标签</label>
                    <select
                      value={bannerForm.category}
                      onChange={e => setBannerForm({ ...bannerForm, category: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                    >
                      {HERO_BANNER_CATEGORY_OPTIONS.map(option => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">标题</label>
                    <input
                      type="text"
                      value={bannerForm.title}
                      onChange={e => setBannerForm({ ...bannerForm, title: e.target.value })}
                      placeholder="如：复古传奇"
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">副标题</label>
                    <input
                      type="text"
                      value={bannerForm.subtitle}
                      onChange={e => setBannerForm({ ...bannerForm, subtitle: e.target.value })}
                      placeholder="如：经典再现，热血重燃"
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">描述</label>
                    <input
                      type="text"
                      value={bannerForm.desc}
                      onChange={e => setBannerForm({ ...bannerForm, desc: e.target.value })}
                      placeholder="简短描述..."
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">图片 URL</label>
                    <input
                      type="text"
                      value={bannerForm.image}
                      onChange={e => setBannerForm({ ...bannerForm, image: e.target.value })}
                      placeholder="https://example.com/banner.jpg"
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                    <p className="text-xs text-gray-400 mt-1">支持任意网络图片地址，建议尺寸 800x600</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">渐变主题</label>
                    <select
                      value={bannerForm.color}
                      onChange={e => setBannerForm({ ...bannerForm, color: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                    >
                      <option value="from-amber-500 to-orange-600">琥珀/橙色</option>
                      <option value="from-cyan-500 to-blue-600">青色/蓝色</option>
                      <option value="from-red-500 to-orange-600">红色/橙色</option>
                      <option value="from-blue-500 to-cyan-600">蓝色/青色</option>
                      <option value="from-emerald-500 to-teal-600">翠绿/蓝绿</option>
                      <option value="from-gray-500 to-slate-600">灰色/石板</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">背景色</label>
                    <select
                      value={bannerForm.bgColor}
                      onChange={e => setBannerForm({ ...bannerForm, bgColor: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                    >
                      <option value="bg-amber-50">琥珀 50</option>
                      <option value="bg-cyan-50">青色 50</option>
                      <option value="bg-red-50">红色 50</option>
                      <option value="bg-blue-50">蓝色 50</option>
                      <option value="bg-emerald-50">翠绿 50</option>
                      <option value="bg-gray-50">灰色 50</option>
                    </select>
                  </div>
                  <label className="sm:col-span-2 flex items-center gap-3 px-3 py-2 border border-gray-200 rounded-lg cursor-pointer">
                    <input
                      type="checkbox"
                      checked={bannerForm.visible}
                      onChange={e => setBannerForm({ ...bannerForm, visible: e.target.checked })}
                      className="rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                    />
                    <span className="text-sm text-gray-700">客户端与官网首页显示此 Banner</span>
                  </label>
                </div>

                {bannerForm.image && (
                  <div className="mt-4">
                    <p className="text-sm text-gray-500 mb-2">预览</p>
                    <img src={bannerForm.image} alt="preview" className="w-full max-w-md h-40 object-cover rounded-xl" />
                  </div>
                )}

                <div className="flex gap-3 mt-6">
                  <button
                    onClick={() => {
                      setEditingBanner(null)
                      setBannerForm(createEmptyHeroBanner(banners.length))
                      setShowBannerForm(false)
                    }}
                    className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    取消
                  </button>
                  <button
                    onClick={() => void handleSaveBanner()}
                    disabled={bannerLoading}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-60 transition-colors"
                  >
                    <Save className="w-4 h-4" />
                    {bannerLoading ? '保存中...' : '保存 Banner'}
                  </button>
                </div>
              </motion.div>
            )}
          </motion.div>
        )}

        {/* 公告管理面板 */}
        {announcementTab && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">首页滚动公告管理</h2>
              <button
                onClick={openAddAnnouncement}
                className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                添加公告
              </button>
            </div>

            {announcementMessage && (
              <div className={`p-3 rounded-lg text-sm ${announcementMessage.includes('成功') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                {announcementMessage}
              </div>
            )}

            {/* 公告列表 */}
            <div className="grid gap-4">
              {announcements.map((announcement) => (
                <motion.div
                  key={announcement.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="bg-white rounded-xl border border-gray-100 p-5"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4 flex-1">
                      <div className={`p-2 rounded-lg ${announcement.visible ? 'bg-orange-50' : 'bg-gray-100'}`}>
                        <Bell className={`w-5 h-5 ${announcement.visible ? 'text-orange-600' : 'text-gray-400'}`} />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <h3 className="font-bold text-gray-900">{announcement.title}</h3>
                          <span className={`px-2 py-0.5 text-xs rounded-full ${announcement.visible ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                            {announcement.visible ? '显示中' : '已隐藏'}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mt-1">{announcement.content}</p>
                        {announcement.link && (
                          <a
                            href={announcement.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 mt-2"
                          >
                            <ExternalLink className="w-3 h-3" />
                            {announcement.link}
                          </a>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleToggleAnnouncement(announcement)}
                        className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${announcement.visible ? 'bg-gray-100 text-gray-600 hover:bg-gray-200' : 'bg-green-50 text-green-600 hover:bg-green-100'}`}
                      >
                        {announcement.visible ? '隐藏' : '显示'}
                      </button>
                      <button
                        onClick={() => openEditAnnouncement(announcement)}
                        className="p-2 rounded-lg hover:bg-blue-50 text-blue-600 transition-colors"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteAnnouncement(announcement.id)}
                        className="p-2 rounded-lg hover:bg-red-50 text-red-600 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* 公告编辑表单 */}
            {editingAnnouncement !== null && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-xl border border-gray-100 p-6"
              >
                <h3 className="text-lg font-bold text-gray-900 mb-4">
                  {editingAnnouncement ? '编辑公告' : '添加公告'}
                </h3>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">公告标题</label>
                    <input
                      type="text"
                      value={announcementForm.title}
                      onChange={e => setAnnouncementForm({ ...announcementForm, title: e.target.value })}
                      placeholder="例如：重要更新通知"
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">公告内容</label>
                    <textarea
                      value={announcementForm.content}
                      onChange={e => setAnnouncementForm({ ...announcementForm, content: e.target.value })}
                      placeholder="公告的具体内容..."
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">跳转链接 <span className="text-gray-400 font-normal">（可选）</span></label>
                    <input
                      type="text"
                      value={announcementForm.link || ''}
                      onChange={e => setAnnouncementForm({ ...announcementForm, link: e.target.value })}
                      placeholder="https://example.com"
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">状态</label>
                    <select
                      value={announcementForm.visible ? 'true' : 'false'}
                      onChange={e => setAnnouncementForm({ ...announcementForm, visible: e.target.value === 'true' })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white"
                    >
                      <option value="true">显示</option>
                      <option value="false">隐藏</option>
                    </select>
                  </div>
                </div>

                <div className="flex gap-3 mt-6">
                  <button
                    onClick={() => { setEditingAnnouncement(null); setAnnouncementForm({ id: 0, title: '', content: '', link: '', visible: true }); }}
                    className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    取消
                  </button>
                  <button
                    onClick={handleSaveAnnouncement}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
                  >
                    <Save className="w-4 h-4" />
                    保存公告
                  </button>
                </div>
              </motion.div>
            )}
          </motion.div>
        )}

        {/* 游戏管理内容（仅在非 Banner/公告 标签时显示） */}
        {!bannerTab && !announcementTab && (
          <>
        {/* 游戏添加/编辑表单 */}
        {showGameForm && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-xl border border-gray-100 p-6 mb-8"
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-900">
                {editingGame ? '编辑游戏' : '添加游戏'}
              </h3>
              <button
                onClick={closeGameForm}
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {message && (
              <div className={`p-4 rounded-xl text-sm mb-6 ${
                message.includes('成功') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
              }`}>
                {message}
              </div>
            )}

            <div className="grid sm:grid-cols-2 gap-5">
              {/* Name */}
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  游戏名称 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder="例如：复古传奇"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
                />
              </div>

              {/* Category */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">分类</label>
                <select
                  value={form.category}
                  onChange={e => setForm({ ...form, category: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-base"
                >
                  {CATEGORY_OPTIONS.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              {/* Status */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">状态</label>
                <select
                  value={form.status}
                  onChange={e => setForm({ ...form, status: e.target.value as any })}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-base"
                >
                  <option value="active">上架</option>
                  <option value="inactive">下架</option>
                  <option value="maintenance">维护</option>
                </select>
              </div>

              {/* Version */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">版本</label>
                <input
                  type="text"
                  value={form.version}
                  onChange={e => setForm({ ...form, version: e.target.value })}
                  placeholder="1.0.0"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
                />
              </div>

              {/* Size */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">大小</label>
                <input
                  type="text"
                  value={form.size}
                  onChange={e => setForm({ ...form, size: e.target.value })}
                  placeholder="例如：500MB"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">开服时间</label>
                <input
                  type="text"
                  value={form.openTime}
                  onChange={e => setForm({ ...form, openTime: e.target.value })}
                  placeholder="例如：2026-07-20 19:00"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">热度值</label>
                <input
                  type="number"
                  min="0"
                  value={form.heat}
                  onChange={e => setForm({ ...form, heat: parseInt(e.target.value) || 0 })}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
                />
              </div>

              {/* Rating */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">评分 (0-10)</label>
                <input
                  type="number"
                  min="0"
                  max="10"
                  step="0.1"
                  value={form.rating}
                  onChange={e => setForm({ ...form, rating: parseFloat(e.target.value) || 0 })}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
                />
              </div>

              {/* Downloads */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">下载量</label>
                <input
                  type="number"
                  min="0"
                  value={form.downloads}
                  onChange={e => setForm({ ...form, downloads: parseInt(e.target.value) || 0 })}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
                />
              </div>

              {/* Download File */}
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  游戏文件 <span className="text-red-500">*</span>
                </label>
                <UppyUploader 
                  type="game" 
                  value={{ url: form.downloadUrl }} 
                  onChange={handleGameFileUpload} 
                />
              </div>

              {/* Cover Image */}
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  封面图片
                </label>
                <UppyUploader 
                  type="cover" 
                  value={{ url: form.imageUrl }} 
                  onChange={handleCoverUpload} 
                />
              </div>

              {/* Guide URL */}
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  攻略链接
                </label>
                <input
                  type="url"
                  value={form.guideUrl}
                  onChange={e => setForm({ ...form, guideUrl: e.target.value })}
                  placeholder="例如：https://docs.qq.com/doc/..."
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
                />
              </div>

              {/* Drop Rate URL */}
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  爆率查询链接
                </label>
                <input
                  type="url"
                  value={form.dropRateUrl}
                  onChange={e => setForm({ ...form, dropRateUrl: e.target.value })}
                  placeholder="例如：https://blcx.567zm.com/"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
                />
              </div>

              {/* Tags */}
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  标签 <span className="text-gray-400 font-normal">（用逗号分隔）</span>
                </label>
                <input
                  type="text"
                  value={form.tags}
                  onChange={e => setForm({ ...form, tags: e.target.value })}
                  placeholder="热血, PK, 打金"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
                />
              </div>

              <div className="sm:col-span-2">
                <div className="rounded-2xl border border-amber-100 bg-amber-50/50 p-4">
                  <div className="mb-4">
                    <div className="text-sm font-semibold text-gray-900">首页 Banner 数据</div>
                    <p className="mt-1 text-xs text-gray-500">填写后会优先用于首页 Hero 轮播；留空则继续回退到站点本地 Banner 配置。</p>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Banner 标题</label>
                      <input
                        type="text"
                        value={form.bannerTitle}
                        onChange={e => setForm({ ...form, bannerTitle: e.target.value })}
                        placeholder="例如：复古传奇"
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Banner 副标题</label>
                      <input
                        type="text"
                        value={form.bannerSubtitle}
                        onChange={e => setForm({ ...form, bannerSubtitle: e.target.value })}
                        placeholder="例如：经典再现，热血重燃"
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Banner 描述</label>
                      <textarea
                        value={form.bannerDesc}
                        onChange={e => setForm({ ...form, bannerDesc: e.target.value })}
                        placeholder="用于首页首屏的简短文案"
                        rows={2}
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-base"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Banner 图片</label>
                      <input
                        type="url"
                        value={form.bannerImage}
                        onChange={e => setForm({ ...form, bannerImage: e.target.value })}
                        placeholder="例如：https://.../banner.jpg"
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">前景渐变</label>
                      <input
                        type="text"
                        value={form.bannerColor}
                        onChange={e => setForm({ ...form, bannerColor: e.target.value })}
                        placeholder="from-amber-500 to-orange-600"
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">背景色标记</label>
                      <input
                        type="text"
                        value={form.bannerBgColor}
                        onChange={e => setForm({ ...form, bannerBgColor: e.target.value })}
                        placeholder="bg-amber-50"
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Description */}
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">描述</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  placeholder="简短描述游戏特色..."
                  rows={3}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-base"
                />
              </div>
            </div>

            {/* Preview */}
            {form.name && (
              <div className="mt-6 p-5 bg-gray-50 rounded-xl">
                <span className="text-sm font-medium text-gray-700 mb-4 block">预览</span>
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 bg-gray-100">
                    {form.imageUrl ? (
                      <img src={form.imageUrl} alt={form.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-blue-500 text-white text-2xl font-bold">
                        {form.name.charAt(0)}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-gray-900 text-lg">{form.name}</div>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="text-sm text-gray-600 bg-white px-2 py-0.5 rounded">{form.category}</span>
                      <span className="text-sm text-gray-400">·</span>
                      <span className="text-sm text-gray-500">v{form.version}</span>
                      {form.tags && (
                        <>
                          <span className="text-sm text-gray-400">·</span>
                          <span className="text-sm text-gray-500">{form.tags}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="flex gap-3 mt-8 pt-6 border-t border-gray-100">
              <button
                onClick={closeGameForm}
                className="flex-1 px-5 py-3 border border-gray-200 rounded-xl hover:bg-gray-100 transition-colors font-medium text-gray-700"
              >
                取消
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 flex items-center justify-center gap-2 px-5 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 font-medium"
              >
                <Save className="w-5 h-5" />
                {saving ? '保存中...' : editingGame ? '保存修改' : '添加游戏'}
              </button>
            </div>
          </motion.div>
        )}

        {/* Stats */}
        <div className="grid sm:grid-cols-3 gap-6 mb-10">
          <div className="bg-white rounded-xl border border-gray-100 p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-50 rounded-lg">
                <Gamepad2 className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">游戏总数</p>
                <p className="text-2xl font-bold text-gray-900">{totalGames}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-50 rounded-lg">
                <Download className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">总下载量</p>
                <p className="text-2xl font-bold text-gray-900">{totalDownloads.toLocaleString()}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-amber-50 rounded-lg">
                <Tag className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">上架中</p>
                <p className="text-2xl font-bold text-gray-900">{activeGames}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Desktop Table */}
        <div className="hidden md:block bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-lg font-semibold text-gray-900">游戏列表</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">游戏</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">分类</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">版本</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">下载量</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">评分</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">状态</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                      加载中...
                    </td>
                  </tr>
                ) : (
                  sortedGames.map((game) => (
                    <tr key={game.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                            {game.imageUrl ? (
                              <img src={game.imageUrl} alt={game.name} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-blue-500 text-white text-sm font-bold">
                                {game.name.charAt(0)}
                              </div>
                            )}
                          </div>
                          <span className="font-medium text-gray-900">{game.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">{game.category}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{game.version}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{game.downloads.toLocaleString()}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{game.rating}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex px-2 py-1 text-xs rounded-full ${
                          game.status === 'active' ? 'bg-green-50 text-green-700' :
                          game.status === 'inactive' ? 'bg-gray-50 text-gray-700' :
                          'bg-yellow-50 text-yellow-700'
                        }`}>
                          {game.status === 'active' ? '上架' : game.status === 'inactive' ? '下架' : '维护'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex justify-end gap-1">
                          <button
                            onClick={() => openEdit(game)}
                            className="p-2 rounded-lg hover:bg-blue-50 text-blue-600 transition-colors"
                            title="编辑"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(game)}
                            className="p-2 rounded-lg hover:bg-red-50 text-red-600 transition-colors"
                            title="删除"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Mobile Cards */}
        <div className="md:hidden space-y-3">
          {sortedGames.map((game) => (
              <motion.div
                key={game.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-xl p-4 border border-gray-100"
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0">
                    {game.imageUrl ? (
                      <img src={game.imageUrl} alt={game.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-blue-500 text-white text-xl font-bold">
                        {game.name.charAt(0)}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900">{game.name}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 text-xs">
                        {game.category}
                      </span>
                      <span className={`text-xs px-1.5 py-0.5 rounded ${
                        game.status === 'active' ? 'bg-green-50 text-green-700' :
                        game.status === 'inactive' ? 'bg-gray-50 text-gray-700' :
                        'bg-yellow-50 text-yellow-700'
                      }`}>
                        {game.status === 'active' ? '上架' : game.status === 'inactive' ? '下架' : '维护'}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      v{game.version} · {game.downloads.toLocaleString()} 下载 · 评分 {game.rating}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 mt-3 pt-3 border-t border-gray-50">
                  <button
                    onClick={() => openEdit(game)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-blue-50 text-blue-600 text-sm font-medium hover:bg-blue-100 transition-colors"
                  >
                    <Edit2 className="w-4 h-4" />
                    编辑
                  </button>
                  <button
                    onClick={() => handleDelete(game)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-red-50 text-red-600 text-sm font-medium hover:bg-red-100 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                    删除
                  </button>
                </div>
              </motion.div>
            ))}

          {games.length === 0 && !loading && (
            <div className="text-center py-16 text-gray-400 bg-white rounded-xl border border-gray-100">
              <Gamepad2 className="w-12 h-12 mx-auto mb-4 opacity-30" />
              <p>暂无游戏，点击上方按钮添加</p>
            </div>
          )}
        </div>
        </>
        )}
      </div>
    </div>
  )
}
