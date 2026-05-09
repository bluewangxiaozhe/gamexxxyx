import { motion } from 'framer-motion'
import { Zap, Shield, RefreshCw, Download } from 'lucide-react'

const features = [
  {
    icon: Zap,
    title: '极速下载',
    desc: '多线程加速，秒下游戏',
    color: 'bg-blue-50 text-blue-600',
  },
  {
    icon: Shield,
    title: '安全无毒',
    desc: '人工审核，放心畅玩',
    color: 'bg-green-50 text-green-600',
  },
  {
    icon: RefreshCw,
    title: '每日更新',
    desc: '新游首发，及时跟进',
    color: 'bg-purple-50 text-purple-600',
  },
  {
    icon: Download,
    title: '一键安装',
    desc: '下载即玩，无需配置',
    color: 'bg-amber-50 text-amber-600',
  },
]

export default function Features() {
  return (
    <section className="py-12 sm:py-16 bg-white">
      <div className="container-custom">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-8 sm:mb-12"
        >
          <h2 className="text-xl sm:text-3xl font-bold text-gray-900">核心优势</h2>
        </motion.div>

        {/* 桌面端：2 列网格 */}
        <div className="hidden sm:grid grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="text-center p-6"
            >
              <div className={`w-16 h-16 ${feature.color} rounded-2xl flex items-center justify-center mx-auto mb-4`}>
                <feature.icon className="w-8 h-8" />
              </div>
              <h3 className="font-bold text-gray-900 mb-2">{feature.title}</h3>
              <p className="text-sm text-gray-500">{feature.desc}</p>
            </motion.div>
          ))}
        </div>
        
        {/* 手机端：2x2 网格 */}
        <div className="sm:hidden grid grid-cols-2 gap-3">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.3, delay: index * 0.05 }}
              className="text-center p-4 bg-gray-50 rounded-xl"
            >
              <div className={`w-10 h-10 ${feature.color} rounded-lg flex items-center justify-center mx-auto mb-2`}>
                <feature.icon className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-gray-900">{feature.title}</h3>
              <p className="text-xs text-gray-500 mt-1">{feature.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
