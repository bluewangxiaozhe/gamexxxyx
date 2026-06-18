# 更新日志

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
