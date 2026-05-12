import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Lock, LogIn, Plus, Edit2, Trash2, Save, X, Gamepad2, Download, Tag, Image, ChevronLeft, Upload } from 'lucide-react'
import { useGames } from '@/hooks/useGames'
import { api } from '@/utils/api'
import type { Game } from '@/types'
import FileUploader from '@/components/FileUploader'
import UppyUploader from '@/components/UppyUploader'
import FilepondUploader from '@/components/FilepondUploader'

type UploaderType = 'default' | 'uppy' | 'filepond'

interface BannerConfig {
  id: number
  title: string
  subtitle: string
  desc: string
  image: string
  color: string
  bgColor: string
}

const defaultBanners: BannerConfig[] = [
  {
    id: 1,
    title: '复古传奇',
    subtitle: '经典再现，热血重燃',
    desc: '原汁原味的传奇体验，战法道三职业，沙巴克攻城等你来战',
    image: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=800&h=600&fit=crop',
    color: 'from-amber-500 to-orange-600',
    bgColor: 'bg-amber-50',
  },
  {
    id: 2,
    title: '沉默专属',
    subtitle: '独家版本，专属神器',
    desc: '全新沉默版本，专属装备系统，打造属于你的传奇之路',
    image: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=800&h=600&fit=crop',
    color: 'from-purple-500 to-indigo-600',
    bgColor: 'bg-purple-50',
  },
  {
    id: 3,
    title: '单职业超变',
    subtitle: '一刀999，爽到飞起',
    desc: '单职业超变版本，超高爆率，装备全靠打，散人也能当大佬',
    image: 'https://images.unsplash.com/photo-1538481199705-c710c4e965fc?w=800&h=600&fit=crop',
    color: 'from-red-500 to-pink-600',
    bgColor: 'bg-red-50',
  },
]

function loadBanners(): BannerConfig[] {
  try {
    const saved = localStorage.getItem('hero_banners')
    if (saved) {
      const parsed = JSON.parse(saved)
      if (Array.isArray(parsed) && parsed.length > 0) return parsed
    }
  } catch { /* ignore */ }
  return defaultBanners
}

function saveBanners(banners: BannerConfig[]) {
  localStorage.setItem('hero_banners', JSON.stringify(banners))
}

const ADMIN_KEY = 'admin_auth'
const ADMIN_PASSWORD = 'Wang147#'

const CATEGORY_OPTIONS = ['单职业', '复古', '微变', '超变', '合击', '沉默', '专属']

interface GameForm {
  name: string
  category: string
  description: string
  version: string
  size: string
  downloadUrl: string
  imageUrl: string
  rating: number
  downloads: number
  status: 'active' | 'inactive' | 'maintenance'
  tags: string
}

function createEmptyForm(): GameForm {
  return {
    name: '',
    category: CATEGORY_OPTIONS[0],
    description: '',
    version: '1.0.0',
    size: '',
    downloadUrl: '',
    imageUrl: '',
    rating: 5.0,
    downloads: 0,
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
    downloadUrl: game.downloadUrl,
    imageUrl: game.imageUrl,
    rating: game.rating,
    downloads: game.downloads,
    status: game.status || 'active',
    tags: game.tags?.join(', ') || '',
  }
}

function formToGame(form: GameForm): Omit<Game, 'id' | 'addedAt'> {
  return {
    name: form.name.trim(),
    category: form.category,
    description: form.description.trim(),
    version: form.version.trim(),
    size: form.size.trim(),
    downloadUrl: form.downloadUrl.trim(),
    imageUrl: form.imageUrl.trim(),
    rating: Number(form.rating) || 0,
    downloads: Number(form.downloads) || 0,
    status: form.status,
    tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
  }
}

export default function Admin() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return sessionStorage.getItem(ADMIN_KEY) === 'true'
  })
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const { games, loading, refetch } = useGames()

  // 排序：active(上架) > maintenance(维护) > inactive(下架)
  const statusOrder: Record<string, number> = { active: 1, maintenance: 2, inactive: 3 }
  const sortedGames = [...games].sort((a, b) => {
    const orderDiff = (statusOrder[a.status || 'inactive'] || 4) - (statusOrder[b.status || 'inactive'] || 4)
    return orderDiff !== 0 ? orderDiff : 0
  })

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingGame, setEditingGame] = useState<Game | null>(null)
  const [form, setForm] = useState<GameForm>(createEmptyForm())
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  // Banner 管理状态
  const [banners, setBanners] = useState<BannerConfig[]>(loadBanners)
  const [bannerTab, setBannerTab] = useState(false)
  const [editingBanner, setEditingBanner] = useState<BannerConfig | null>(null)
  const [bannerForm, setBannerForm] = useState<BannerConfig>(defaultBanners[0])
  const [bannerMessage, setBannerMessage] = useState('')

  // 上传组件选择状态
  const [uploaderType, setUploaderType] = useState<UploaderType>(() => {
    return (localStorage.getItem('uploader_type') as UploaderType) || 'default'
  })

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    if (password === ADMIN_PASSWORD) {
      sessionStorage.setItem(ADMIN_KEY, 'true')
      setIsAuthenticated(true)
      setError('')
    } else {
      setError('密码错误')
    }
  }

  const handleLogout = () => {
    sessionStorage.removeItem(ADMIN_KEY)
    setIsAuthenticated(false)
    setPassword('')
  }

  const openAdd = () => {
    setEditingGame(null)
    setForm(createEmptyForm())
    setIsModalOpen(true)
    setMessage('')
  }

  const openEdit = (game: Game) => {
    setEditingGame(game)
    setForm(gameToForm(game))
    setIsModalOpen(true)
    setMessage('')
  }

  const closeModal = () => {
    setIsModalOpen(false)
    setEditingGame(null)
    setForm(createEmptyForm())
    setMessage('')
  }

  // Banner 管理函数
  const openAddBanner = () => {
    setEditingBanner(null)
    setBannerForm({ ...defaultBanners[0], id: Date.now(), title: '', subtitle: '', desc: '', image: '' })
    setBannerMessage('')
  }

  const openEditBanner = (banner: BannerConfig) => {
    setEditingBanner(banner)
    setBannerForm({ ...banner })
    setBannerMessage('')
  }

  const handleSaveBanner = () => {
    if (!bannerForm.title.trim() || !bannerForm.image.trim()) {
      setBannerMessage('请填写标题和图片地址')
      return
    }
    const newBanners = editingBanner
      ? banners.map(b => b.id === editingBanner.id ? bannerForm : b)
      : [...banners, bannerForm]
    setBanners(newBanners)
    saveBanners(newBanners)
    setBannerMessage('保存成功！刷新首页生效')
    setEditingBanner(null)
  }

  const handleDeleteBanner = (id: number) => {
    if (!confirm('确定删除这个 Banner 吗？')) return
    const newBanners = banners.filter(b => b.id !== id)
    setBanners(newBanners)
    saveBanners(newBanners)
  }

  const handleMoveBanner = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return
    if (direction === 'down' && index === banners.length - 1) return
    const newBanners = [...banners]
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    ;[newBanners[index], newBanners[targetIndex]] = [newBanners[targetIndex], newBanners[index]]
    setBanners(newBanners)
    saveBanners(newBanners)
  }

  const handleUploaderChange = (type: UploaderType) => {
    setUploaderType(type)
    localStorage.setItem('uploader_type', type)
  }

  const renderUploader = (type: 'game' | 'cover' | 'screenshot', value: string, onChange: (url: string) => void) => {
    switch (uploaderType) {
      case 'uppy':
        return <UppyUploader type={type} value={value} onChange={onChange} />
      case 'filepond':
        return <FilepondUploader type={type} value={value} onChange={onChange} />
      default:
        return <FileUploader type={type} value={value} onChange={onChange} />
    }
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
        setTimeout(() => closeModal(), 800)
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
    if (!confirm(`确定要删除「${game.name}」吗？此操作不可恢复。`)) return

    const response = await api.deleteGame(game.id)
    if (response.success) {
      await refetch()
    } else {
      alert(response.message || '删除失败')
    }
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
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <LogIn className="w-4 h-4" />
                登录
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-10">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">管理后台</h1>
            <p className="text-gray-500 mt-1">管理游戏列表，数据实时同步到数据库</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {/* 上传组件切换 */}
            <div className="flex items-center gap-1 px-2 py-1 bg-gray-100 rounded-lg">
              <Upload className="w-4 h-4 text-gray-500 mr-1" />
              <span className="text-xs text-gray-500 mr-2">上传:</span>
              {[
                { key: 'default', label: '默认' },
                { key: 'uppy', label: 'Uppy' },
                { key: 'filepond', label: 'Filepond' },
              ].map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => handleUploaderChange(key as UploaderType)}
                  className={`px-2 py-1 text-xs rounded transition-colors ${
                    uploaderType === key
                      ? 'bg-blue-500 text-white'
                      : 'text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <button
              onClick={exportJSON}
              className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Download className="w-4 h-4" />
              导出JSON
            </button>
            <button
              onClick={openAdd}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              添加游戏
            </button>
            <button
              onClick={() => setBannerTab(!bannerTab)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${bannerTab ? 'bg-purple-600 text-white' : 'border border-gray-200 hover:bg-gray-50'}`}
            >
              <Image className="w-4 h-4" />
              {bannerTab ? '返回游戏' : 'Banner管理'}
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
              <h2 className="text-xl font-bold text-gray-900">首页 Banner 管理</h2>
              <button
                onClick={openAddBanner}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                添加 Banner
              </button>
            </div>

            {bannerMessage && (
              <div className={`p-3 rounded-lg text-sm ${bannerMessage.includes('成功') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                {bannerMessage}
              </div>
            )}

            {/* Banner 列表 */}
            <div className="grid gap-4">
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
                          <h3 className="font-bold text-gray-900">{banner.title}</h3>
                          <p className="text-sm text-gray-500 mt-1">{banner.subtitle}</p>
                          <p className="text-xs text-gray-400 mt-1 line-clamp-2">{banner.desc}</p>
                          <p className="text-xs text-gray-400 mt-2 break-all">{banner.image}</p>
                        </div>
                        <div className="flex flex-col gap-1 flex-shrink-0">
                          <button
                            onClick={() => handleMoveBanner(index, 'up')}
                            disabled={index === 0}
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
                            onClick={() => handleMoveBanner(index, 'down')}
                            disabled={index === banners.length - 1}
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
            {(editingBanner !== null || bannerForm.title === '') && (
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
                    <label className="block text-sm font-medium text-gray-700 mb-1">标题</label>
                    <input
                      type="text"
                      value={bannerForm.title}
                      onChange={e => setBannerForm({ ...bannerForm, title: e.target.value })}
                      placeholder="如：复古传奇"
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">副标题</label>
                    <input
                      type="text"
                      value={bannerForm.subtitle}
                      onChange={e => setBannerForm({ ...bannerForm, subtitle: e.target.value })}
                      placeholder="如：经典再现，热血重燃"
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">描述</label>
                    <input
                      type="text"
                      value={bannerForm.desc}
                      onChange={e => setBannerForm({ ...bannerForm, desc: e.target.value })}
                      placeholder="简短描述..."
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">图片 URL</label>
                    <input
                      type="text"
                      value={bannerForm.image}
                      onChange={e => setBannerForm({ ...bannerForm, image: e.target.value })}
                      placeholder="https://example.com/banner.jpg"
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                    <p className="text-xs text-gray-400 mt-1">支持任意网络图片地址，建议尺寸 800x600</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">渐变主题</label>
                    <select
                      value={bannerForm.color}
                      onChange={e => setBannerForm({ ...bannerForm, color: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="from-amber-500 to-orange-600">琥珀/橙色</option>
                      <option value="from-purple-500 to-indigo-600">紫色/靛蓝</option>
                      <option value="from-red-500 to-pink-600">红色/粉色</option>
                      <option value="from-blue-500 to-cyan-600">蓝色/青色</option>
                      <option value="from-green-500 to-emerald-600">绿色/翠绿</option>
                      <option value="from-gray-500 to-slate-600">灰色/石板</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">背景色</label>
                    <select
                      value={bannerForm.bgColor}
                      onChange={e => setBannerForm({ ...bannerForm, bgColor: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="bg-amber-50">琥珀 50</option>
                      <option value="bg-purple-50">紫色 50</option>
                      <option value="bg-red-50">红色 50</option>
                      <option value="bg-blue-50">蓝色 50</option>
                      <option value="bg-green-50">绿色 50</option>
                      <option value="bg-gray-50">灰色 50</option>
                    </select>
                  </div>
                </div>

                {bannerForm.image && (
                  <div className="mt-4">
                    <p className="text-sm text-gray-500 mb-2">预览</p>
                    <img src={bannerForm.image} alt="preview" className="w-full max-w-md h-40 object-cover rounded-xl" />
                  </div>
                )}

                <div className="flex gap-3 mt-6">
                  <button
                    onClick={() => { setEditingBanner(null); setBannerForm(defaultBanners[0]) }}
                    className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    取消
                  </button>
                  <button
                    onClick={handleSaveBanner}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                  >
                    <Save className="w-4 h-4" />
                    保存 Banner
                  </button>
                </div>
              </motion.div>
            )}
          </motion.div>
        )}

        {/* 游戏管理内容（仅在非 Banner 标签时显示） */}
        {!bannerTab && (
          <>
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
              <div className="p-3 bg-purple-50 rounded-lg">
                <Tag className="w-6 h-6 text-purple-600" />
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
                            className="p-2 rounded-lg hover:bg-blue-50 text-gray-400 hover:text-blue-500 transition-colors"
                            title="编辑"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(game)}
                            className="p-2 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
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
          <AnimatePresence>
            {sortedGames.map((game) => (
              <motion.div
                key={game.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="bg-white rounded-xl p-4 border border-gray-100"
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0">
                    {game.imageUrl ? (
                      <img src={game.imageUrl} alt={game.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-blue-500 text-white text-lg font-bold">
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
          </AnimatePresence>

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

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={(e) => e.target === e.currentTarget && closeModal()}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden"
            >
              <div className="flex-shrink-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">
                  {editingGame ? '编辑游戏' : '添加游戏'}
                </h2>
                <button
                  onClick={closeModal}
                  className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto">
                <div className="p-6 space-y-5">
                {message && (
                  <div className={`p-3 rounded-lg text-sm ${
                    message.includes('成功') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                  }`}>
                    {message}
                  </div>
                )}

                <div className="grid sm:grid-cols-2 gap-5">
                  {/* Name */}
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      游戏名称 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={form.name}
                      onChange={e => setForm({ ...form, name: e.target.value })}
                      placeholder="例如：复古传奇"
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  {/* Category */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">分类</label>
                    <select
                      value={form.category}
                      onChange={e => setForm({ ...form, category: e.target.value })}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                    >
                      {CATEGORY_OPTIONS.map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>

                  {/* Status */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">状态</label>
                    <select
                      value={form.status}
                      onChange={e => setForm({ ...form, status: e.target.value as any })}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                    >
                      <option value="active">上架</option>
                      <option value="inactive">下架</option>
                      <option value="maintenance">维护</option>
                    </select>
                  </div>

                  {/* Version */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">版本</label>
                    <input
                      type="text"
                      value={form.version}
                      onChange={e => setForm({ ...form, version: e.target.value })}
                      placeholder="1.0.0"
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  {/* Size */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">大小</label>
                    <input
                      type="text"
                      value={form.size}
                      onChange={e => setForm({ ...form, size: e.target.value })}
                      placeholder="例如：500MB"
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  {/* Rating */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">评分 (0-10)</label>
                    <input
                      type="number"
                      min="0"
                      max="10"
                      step="0.1"
                      value={form.rating}
                      onChange={e => setForm({ ...form, rating: parseFloat(e.target.value) || 0 })}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  {/* Downloads */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">下载量</label>
                    <input
                      type="number"
                      min="0"
                      value={form.downloads}
                      onChange={e => setForm({ ...form, downloads: parseInt(e.target.value) || 0 })}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  {/* Download File */}
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      游戏文件 <span className="text-red-500">*</span>
                    </label>
                    {renderUploader('game', form.downloadUrl, (url) => setForm({ ...form, downloadUrl: url }))}
                  </div>

                  {/* Cover Image */}
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      封面图片
                    </label>
                    {renderUploader('cover', form.imageUrl, (url) => setForm({ ...form, imageUrl: url }))}
                  </div>

                  {/* Tags */}
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      标签 <span className="text-gray-400 font-normal">（用逗号分隔）</span>
                    </label>
                    <input
                      type="text"
                      value={form.tags}
                      onChange={e => setForm({ ...form, tags: e.target.value })}
                      placeholder="热血, PK, 打金"
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  {/* Description */}
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">描述</label>
                    <textarea
                      value={form.description}
                      onChange={e => setForm({ ...form, description: e.target.value })}
                      placeholder="简短描述游戏特色..."
                      rows={3}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    />
                  </div>
                </div>

                {/* Preview */}
                {form.name && (
                  <div className="p-4 bg-gray-50 rounded-xl">
                    <span className="text-sm text-gray-500 mb-3 block">预览</span>
                    <div className="flex items-center gap-3">
                      <div className="w-14 h-14 rounded-xl overflow-hidden flex-shrink-0">
                        {form.imageUrl ? (
                          <img src={form.imageUrl} alt={form.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-blue-500 text-white text-xl font-bold">
                            {form.name.charAt(0)}
                          </div>
                        )}
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">{form.name}</div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-gray-500">{form.category}</span>
                          <span className="text-xs text-gray-400">·</span>
                          <span className="text-xs text-gray-500">v{form.version}</span>
                          {form.tags && (
                            <>
                              <span className="text-xs text-gray-400">·</span>
                              <span className="text-xs text-gray-500">{form.tags}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                </div>
              </div>
              {/* Footer - Fixed */}
              <div className="flex-shrink-0 border-t border-gray-100 px-6 py-4">
                <div className="flex gap-3">
                  <button
                    onClick={closeModal}
                    className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    取消
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" />
                    {saving ? '保存中...' : editingGame ? '保存修改' : '添加游戏'}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
