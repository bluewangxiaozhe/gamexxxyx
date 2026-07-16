import { motion } from 'framer-motion'
import { Download, Monitor, CheckCircle } from 'lucide-react'
import { useClientUpdate } from '@/hooks/useClientUpdate'

const features = [
  '海量游戏',
  '高速下载',
  '自动更新',
  '安全无毒',
]

export default function DownloadCTA() {
  const { update: clientUpdate, loading: clientUpdateLoading } = useClientUpdate()

  return (
    <section className="py-20 bg-gray-900 text-white overflow-hidden relative">
      {/* 背景装饰 */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary-500 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500 rounded-full blur-3xl" />
      </div>

      <div className="container-custom relative z-10">
        <div className="max-w-4xl mx-auto">
          {/* 桌面端：双列布局 */}
          <div className="hidden md:grid grid-cols-2 gap-12 items-center">
            {/* 左侧文案 */}
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <h2 className="text-4xl font-bold mb-4">
                下载 <span className="text-primary-400">小小小游戏</span>
              </h2>
              <p className="text-gray-400 text-lg mb-8">
                Windows 客户端，海量游戏一键下载安装
              </p>

              <ul className="space-y-4 mb-10">
                {features.map((feature) => (
                  <li key={feature} className="flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />
                    <span className="text-gray-300">{feature}</span>
                  </li>
                ))}
              </ul>

              {clientUpdate ? (
                <a
                  href={clientUpdate.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-3 px-8 py-4 bg-primary-600 hover:bg-primary-700 rounded-2xl font-bold text-lg transition-colors"
                >
                  <Monitor className="w-6 h-6" />
                  下载 Windows 客户端
                  <span className="text-sm font-normal text-primary-200">v{clientUpdate.version}</span>
                </a>
              ) : (
                <span className="inline-flex items-center gap-3 px-8 py-4 bg-gray-700 rounded-2xl font-bold text-lg text-gray-300" aria-disabled="true">
                  <Monitor className="w-6 h-6" />
                  {clientUpdateLoading ? '正在获取下载信息' : '下载暂不可用'}
                </span>
              )}

              <p className="mt-4 text-sm text-gray-500">
                安装前请确认系统满足客户端要求
              </p>
            </motion.div>

            {/* 右侧客户端预览 */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="relative"
            >
              <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700">
                {/* 窗口标题栏 */}
                <div className="flex items-center gap-2 mb-4 pb-4 border-b border-gray-700">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-red-500" />
                    <div className="w-3 h-3 rounded-full bg-yellow-500" />
                    <div className="w-3 h-3 rounded-full bg-green-500" />
                  </div>
                  <span className="text-sm text-gray-400 ml-2">小小小游戏</span>
                </div>

                {/* 模拟内容 */}
                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-3 bg-gray-700/50 rounded-xl">
                    <div className="w-12 h-12 bg-gradient-to-br from-amber-400 to-orange-500 rounded-lg flex items-center justify-center text-white font-bold">
                      传
                    </div>
                    <div className="flex-1">
                      <div className="font-medium">复古传奇</div>
                      <div className="text-xs text-gray-400">v1.0.0 · 1.2GB</div>
                    </div>
                    <div className="px-3 py-1 bg-green-500/20 text-green-400 text-xs rounded-lg">
                      已安装
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-3 bg-gray-700/50 rounded-xl">
                    <div className="w-12 h-12 bg-gradient-to-br from-purple-400 to-indigo-500 rounded-lg flex items-center justify-center text-white font-bold">
                      沉
                    </div>
                    <div className="flex-1">
                      <div className="font-medium">沉默专属</div>
                      <div className="text-xs text-gray-400">v2.1.0 · 856MB</div>
                    </div>
                    <div className="px-3 py-1 bg-primary-500/20 text-primary-400 text-xs rounded-lg flex items-center gap-1">
                      <Download className="w-3 h-3" />
                      下载中 45%
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-3 bg-gray-700/50 rounded-xl">
                    <div className="w-12 h-12 bg-gradient-to-br from-red-400 to-pink-500 rounded-lg flex items-center justify-center text-white font-bold">
                      超
                    </div>
                    <div className="flex-1">
                      <div className="font-medium">单职业超变</div>
                      <div className="text-xs text-gray-400">v3.0.0 · 2.1GB</div>
                    </div>
                    <button className="px-3 py-1 bg-primary-600 text-white text-xs rounded-lg hover:bg-primary-700 transition-colors">
                      下载
                    </button>
                  </div>
                </div>
              </div>

              {/* 浮动装饰 */}
              <motion.div
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 3, repeat: Infinity }}
                className="absolute -top-4 -right-4 w-20 h-20 bg-primary-500 rounded-2xl flex items-center justify-center shadow-lg"
              >
                <Download className="w-8 h-8 text-white" />
              </motion.div>
            </motion.div>
          </div>
          
          {/* 手机端：单列简化布局 */}
          <div className="md:hidden">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center py-8"
            >
              {/* 大标题 + 下载按钮 */}
              <h2 className="text-xl font-bold mb-2">
                下载 <span className="text-primary-400">小小小游戏</span>
              </h2>
              <p className="text-gray-400 text-sm mb-6">海量游戏一键下载安装</p>
              
              {/* 下载按钮 */}
              {clientUpdate ? (
                <a
                  href={clientUpdate.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 w-full px-6 py-4 bg-primary-600 hover:bg-primary-700 rounded-xl font-bold text-lg transition-colors mb-6"
                >
                  <Monitor className="w-6 h-6" />
                  立即下载
                  <span className="text-sm font-normal text-primary-200">v{clientUpdate.version}</span>
                </a>
              ) : (
                <span className="inline-flex items-center justify-center gap-2 w-full px-6 py-4 bg-gray-700 rounded-xl font-bold text-lg text-gray-300 mb-6" aria-disabled="true">
                  <Monitor className="w-6 h-6" />
                  {clientUpdateLoading ? '正在获取下载信息' : '下载暂不可用'}
                </span>
              )}
              
              {/* 简化特性标签 */}
              <div className="flex flex-wrap justify-center gap-2">
                {features.map((feature) => (
                  <span
                    key={feature}
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-gray-800 rounded-lg text-xs text-gray-300"
                  >
                    <CheckCircle className="w-3 h-3 text-green-400" />
                    {feature}
                  </span>
                ))}
              </div>
              
              <p className="mt-4 text-xs text-gray-500">
                安装前请确认系统满足客户端要求
              </p>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  )
}
