# 更新日志

## [2.2.0] - 2026-07-06

### ✨ 新功能
- **独立首页 Banner 数据源**：新增 `hero_banners` 表与 `/api/hero-banners` 接口，首页 Banner 不再长期依赖 `games.banner` 或后台本地 `localStorage`
- **后台 Banner 服务端化**：管理后台的 Banner 管理改为直接调用服务端接口，支持共享给官网首页与后续客户端消费
- **首页 Hero 共享消费**：首页 `Hero` 优先消费服务端 `hero_banners` 数据，`games.banner` 降级为过渡兜底，默认 Banner 继续保底

### 🧱 数据结构调整
- `games` 表补齐 `openTime`、`heat`、`banner` 字段，用于首页排序与过渡兼容
- 新增 `HeroBanner` 类型、`useHeroBanners` Hook 与对应 API 封装

### 🚀 上线记录
- 生产 API `https://api.567zm.com/api/hero-banners` 已确认可读
- 生产 `/api/auth/check` 已确认在携带正确 `ADMIN_TOKEN` 时返回成功
- 本轮停止继续做写接口与页面实点测试，先完成文档、构建与推送


## [2.1.0] - 2026-06-18

### ✨ 新功能
- **国内 CDN 加速**：中国大陆访客的下载链接与图片自动切换到腾讯 EdgeOne 加速域名（`down.567zm.com`），海外访客保持 R2 原始域名（`oss.wangzhe.me`）
  - 通过 Cloudflare `/cdn-cgi/trace` 判断访客地区，结果按会话缓存，仅请求一次
  - trace 失败时回退到时区 + 语言启发式判断
  - 文件仍以 R2 原始地址存储，前端渲染时换域名，后台不受影响

### 🔒 安全
- **后端写接口鉴权**：`POST/PUT/DELETE /api/games` 与所有 `/api/upload/*` 接口现需携带 `ADMIN_TOKEN` 令牌，未授权返回 401
- 后台登录改为服务端校验（`GET /api/auth/check`），移除前端硬编码密码
- 未配置 `ADMIN_TOKEN` 时后端拒绝一切写操作（503），避免接口裸奔

### 🧹 重构
- 删除未使用的上传组件 `FileUploader.tsx`、`FilepondUploader.tsx`，移除 `react-dropzone` 依赖
- 更正 README 技术栈说明（SQLite，非 MariaDB），补充 CDN 与鉴权文档

---

## [2.0.1] - 2026-05-14

### 🐛 Bug 修复
- 修复后台编辑按钮点击后弹出 alert 的问题
- 删除调试代码 (console.log)
- 确保首页公告链接安全性 (rel="noopener noreferrer")

### ✨ 新功能
- 新增公告管理系统
  - 后台新增"公告管理"Tab
  - 支持添加/编辑/删除公告
  - 支持开启/关闭公告显示
  - 首页顶部滚动公告栏
  - 公告数据存储于 localStorage

---

## [2.0.0] - (历史版本)
- Initial release
