import { motion } from 'framer-motion'
import { Sword, Shield, Zap, Target, Flame, Ghost } from 'lucide-react'
import { Link } from 'react-router-dom'

const categories = [
  { name: '单职业', icon: Sword, color: 'bg-blue-50 text-blue-600' },
  { name: '复古', icon: Shield, color: 'bg-amber-50 text-amber-600' },
  { name: '微变', icon: Zap, color: 'bg-green-50 text-green-600' },
  { name: '超变', icon: Target, color: 'bg-purple-50 text-purple-600' },
  { name: '合击', icon: Flame, color: 'bg-red-50 text-red-600' },
  { name: '沉默', icon: Ghost, color: 'bg-gray-50 text-gray-600' },
]

export default function CategoryNav() {
  // 手机端只显示前 4 个核心分类
  const mobileCategories = categories.slice(0, 4)
  
  return (
    <section className="py-8 sm:py-12 bg-white border-b border-gray-100">
      <div className="container-custom">
        {/* 标题 */}
        <h3 className="text-lg font-bold text-gray-900 mb-6 sm:hidden">游戏分类</h3>
        
        {/* 桌面端：网格布局 */}
        <div className="hidden sm:grid grid-cols-6 gap-4">
          {categories.map((cat, index) => (
            <motion.div
              key={cat.name}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: index * 0.05 }}
            >
              <Link
                to={`/games?category=${encodeURIComponent(cat.name)}`}
                className="flex flex-col items-center gap-3 p-4 rounded-2xl hover:bg-gray-50 transition-colors group"
              >
                <div className={`w-14 h-14 ${cat.color} rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform`}>
                  <cat.icon className="w-7 h-7" />
                </div>
                <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900">
                  {cat.name}
                </span>
              </Link>
            </motion.div>
          ))}
        </div>
        
        {/* 手机端：精简 4 个分类 + 横向滚动 */}
        <div className="sm:hidden overflow-x-auto pb-2 -mx-4 px-4">
          <div className="flex gap-3">
            {mobileCategories.map((cat, index) => (
              <motion.div
                key={cat.name}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
                className="flex-shrink-0"
              >
                <Link
                  to={`/games?category=${encodeURIComponent(cat.name)}`}
                  className="flex flex-col items-center gap-2 p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors group min-w-[72px]"
                >
                  <div className={`w-11 h-11 ${cat.color} rounded-lg flex items-center justify-center group-hover:scale-105 transition-transform`}>
                    <cat.icon className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-medium text-gray-700 whitespace-nowrap">
                    {cat.name}
                  </span>
                </Link>
              </motion.div>
            ))}
            {/* 更多分类提示 */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3, delay: mobileCategories.length * 0.05 }}
              className="flex-shrink-0"
            >
              <Link
                to="/games"
                className="flex flex-col items-center gap-2 p-3 rounded-xl bg-gradient-to-br from-gray-100 to-gray-200 hover:from-gray-200 hover:to-gray-300 transition-all group min-w-[72px] border border-gray-200"
              >
                <div className="w-11 h-11 bg-white rounded-lg flex items-center justify-center group-hover:scale-105 transition-transform shadow-sm">
                  <span className="text-lg font-bold text-gray-600">···</span>
                </div>
                <span className="text-xs font-medium text-gray-600 whitespace-nowrap">
                  更多
                </span>
              </Link>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  )
}
