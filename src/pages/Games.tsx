import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import GameGrid from '@/components/GameGrid'
import { useGames } from '@/hooks/useGames'
import { Search, SlidersHorizontal } from 'lucide-react'

const categories = ['全部', '单职业', '复古', '微变', '超变', '合击', '沉默', '专属']

export default function Games() {
  const { games, loading, error } = useGames()
  const [searchParams, setSearchParams] = useSearchParams()

  const urlSearch = searchParams.get('search') || ''
  const urlCategory = searchParams.get('category') || '全部'

  const [searchQuery, setSearchQuery] = useState(urlSearch)
  const [selectedCategory, setSelectedCategory] = useState(urlCategory)

  // 同步 URL 参数到状态
  useEffect(() => {
    const s = searchParams.get('search') || ''
    const c = searchParams.get('category') || '全部'
    setSearchQuery(s)
    setSelectedCategory(c)
  }, [searchParams])

  // 公共列表完全按添加时间排序；维护状态只影响下载操作，不改变时间顺序。
  const sortedGames = [...games].sort((a, b) => {
    const bTime = Date.parse(b.createdAt || '') || 0
    const aTime = Date.parse(a.createdAt || '') || 0
    return bTime - aTime || b.id - a.id
  })

  const filteredGames = sortedGames.filter((game) => {
    const matchesSearch = !searchQuery ||
      game.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      game.description.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesCategory = selectedCategory === '全部' || game.category === selectedCategory
    return matchesSearch && matchesCategory
  })

  return (
    <div className="py-12">
      <div className="container-custom">
        <div className="mb-10">
          <h1 className="text-3xl font-bold text-gray-900">游戏库</h1>
          <p className="mt-2 text-gray-600">浏览我们精选的游戏合集</p>
        </div>

        {/* Search and Filter */}
        <div className="flex flex-col sm:flex-row gap-4 mb-8">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="搜索游戏..."
              value={searchQuery}
              onChange={(e) => {
                const val = e.target.value
                setSearchQuery(val)
                if (val) {
                  setSearchParams({ search: val })
                } else {
                  setSearchParams({})
                }
              }}
              className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
          <div className="flex items-center gap-2 overflow-x-auto pb-2">
            <SlidersHorizontal className="w-5 h-5 text-gray-400 flex-shrink-0" />
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => {
                  setSelectedCategory(category)
                  if (category === '全部') {
                    setSearchParams({})
                  } else {
                    setSearchParams({ category })
                  }
                }}
                className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                  selectedCategory === category
                    ? 'bg-primary-600 text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
                }`}
              >
                {category}
              </button>
            ))}
          </div>
        </div>

        <GameGrid games={filteredGames} loading={loading} error={error} />
      </div>
    </div>
  )
}
