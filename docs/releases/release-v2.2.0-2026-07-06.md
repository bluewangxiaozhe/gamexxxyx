# v2.2.0 发布记录

## 版本信息
- 版本号：`v2.2.0`
- 记录日期：`2026-07-06`
- 代码分支：`main`
- 部署形态：
  - 前端：Vite `dist/`
  - 后端：`/opt/gamexxxyx-api/server.js` + `gamexxxyx-api.service`

## 本次变更

### 1. 独立首页 Banner 数据源
- 新增 `hero_banners` 表
- 新增 `/api/hero-banners` 读写接口
- 首页 `Hero` 优先改为消费共享 Banner 数据
- `games.banner` 仅保留为过渡兜底，不再作为长期主数据源

### 2. 后台 Banner 管理服务端化
- 管理后台 `Banner 管理` 从 `localStorage` 迁往服务端接口
- 新增 Banner 的新增、编辑、删除、排序、显隐字段读写
- 官网首页与后续客户端可共用同一组 Banner 数据

### 3. 首页排序与类型补齐
- `games` 表补齐 `openTime`、`heat`、`banner` 字段
- 前端补充 `HeroBanner` 类型、`useHeroBanners` Hook、对应 API 封装

## 构建结果
- `dist/index.html`：`0.89 kB`，gzip `0.61 kB`
- `dist/assets/index-BRiJStfV.css`：`36.04 kB`，gzip `6.36 kB`
- `dist/assets/index-Dv4UFmc_.js`：`419.69 kB`，gzip `130.83 kB`
- 本地构建命令：`npm.cmd run build`
- 本地打包产物：`.codex-tmp/packages/gamexxxyx-v2-v2.2.0-20260706.zip`

## 生产状态记录
- `GET https://api.567zm.com/api/hero-banners` 已返回 `[]`，确认新接口已上线可读
- `GET /api/auth/check` 携带正确 `ADMIN_TOKEN` 已返回 `{"success":true}`
- 本轮按决定停止继续做写接口实测与页面实点，先完成文档、构建、打包、推送

## 后续待办
- 用真实后台页面完成 Banner 新增 / 编辑 / 排序 / 删除联调
- 将首页公告从 `localStorage` 迁移到服务端共享数据源
- 继续推进下载链接签名化与客户端 / 官网大陆 CDN 统一策略
