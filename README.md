# 小小小游戏官网 V2

> 现代极简风格的游戏下载平台

## 在线预览

- **官网**: https://bluewangxiaozhe.github.io/gamexxxyx


## 技术栈

- React 18 + Vite 5 + TypeScript
- Tailwind CSS + Framer Motion
- HashRouter（适配 GitHub Pages）
- Node.js + Express + SQLite（better-sqlite3）API
- 文件存储：Cloudflare R2（S3 兼容）
- 国内加速：腾讯 EdgeOne CDN（中国大陆访客自动切换）

## 本地开发

```bash
npm install
npm run dev
```

## 构建

```bash
npm run build
# 产物在 dist/ 目录
```

## 项目结构

```
src/
  components/    # 组件
  pages/         # 页面
  hooks/         # Hooks
  utils/         # 工具
  types/         # 类型定义
public/
  logo.png       # 网站 Logo
  favicon.ico    # 网站图标
```

## 管理后台

访问 `/#/admin`，输入管理密码登录。

密码即服务端环境变量 `ADMIN_TOKEN`，登录时由后端 `/api/auth/check` 校验。
所有写接口（增删改游戏、Banner 管理、文件上传）都需要携带该令牌，未授权请求会被后端拒绝（401）。
**未配置 `ADMIN_TOKEN` 时，后端会拒绝一切写操作（返回 503）。**

## 国内 CDN 加速（线路切换）

文件统一以 R2 原始地址（`oss.wangzhe.me`）存储。前端渲染时通过
`oss.wangzhe.me/cdn-cgi/trace` 判断访客地区：

- 中国大陆访客：下载链接与图片域名替换为腾讯 EdgeOne 加速域名 `down.567zm.com`
- 海外访客：保持 R2 原始域名 `oss.wangzhe.me`

域名可通过前端环境变量 `VITE_R2_HOST` / `VITE_CN_HOST` 覆盖。
后台管理页始终显示 R2 原始地址，不受地区切换影响。

## 服务端部署

后端 API（`server.js` + `api-package.json`）单独部署到服务器，所需环境变量见
`server.env.example`。生产当前通过 `systemd` 服务 `gamexxxyx-api.service` 运行，`WorkingDirectory`
为 `/opt/gamexxxyx-api`，`ExecStart=/usr/bin/node /opt/gamexxxyx-api/server.js`。关键变量：

- `ADMIN_TOKEN`：后台登录密码 / 写接口令牌（**必填**）
- `R2_*`：Cloudflare R2 存储配置
- `CORS_ORIGIN`：允许的前端来源（逗号分隔）

更完整的生产环境、上线、回滚与服务信息见：
- `[docs/deployment/api-server-production-2026-07-06.md](./docs/deployment/api-server-production-2026-07-06.md)`

### 2026-07-06 Banner 共享数据源进展

- 新增独立 `hero_banners` 表与 `/api/hero-banners` 读写接口，作为官网首页与客户端 Banner 的共享数据源
- 后台 `Banner 管理` 已改为走服务端接口，不再继续依赖 `localStorage`
- 首页 `Hero` 优先消费 `/api/hero-banners`，`games.banner` 仅保留过渡兜底
- 生产接口已确认：
  - `GET https://api.567zm.com/api/hero-banners` 可读
  - `GET /api/auth/check` 携带正确 `ADMIN_TOKEN` 可通过鉴权
- 本轮未继续做写接口联调与页面实点，转为先构建、推送与记录

## 更新日志

### v2.1.0
- 国内访客自动切换腾讯 EdgeOne CDN 加速线路
- 后端写接口（增删改 / 上传）加 `ADMIN_TOKEN` 鉴权
- 清理冗余上传组件

### v2.2.0
- 独立 `hero_banners` API 上线
- 后台 Banner 管理迁移到服务端共享数据源
- 首页 Hero 优先消费共享 Banner 数据

### v2.0.0
- 全新现代极简设计
- HashRouter 适配 GitHub Pages
- 完整增删改查管理后台
- Banner 轮播管理
- 搜索 + 分类过滤
