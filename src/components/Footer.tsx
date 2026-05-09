export default function Footer() {
  return (
    <footer className="bg-white border-t border-gray-100">
      <div className="container-custom py-12">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <img
              src="/logo.png"
              alt="小小小游戏盒子"
              className="w-6 h-6 object-contain"
              onError={(e) => {
                const target = e.target as HTMLImageElement
                target.style.display = 'none'
              }}
            />
            <span className="text-lg font-semibold text-blue-400">小小小游戏盒子</span>
          </div>
          <p className="text-sm text-gray-500">
            © 2026 小小小游戏盒子. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  )
}
