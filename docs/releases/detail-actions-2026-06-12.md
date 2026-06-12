# 游戏详情页操作按钮更新 - 2026-06-12

## 更新概述

本次更新围绕游戏详情页的操作入口展开，新增攻略入口和爆率查询入口，并为后续按游戏单独配置爆率查询链接预留字段。

## 更新内容

### 1. 游戏详情页新增操作按钮

修改文件：`src/pages/GameDetail.tsx`

- 在详情页右侧下载卡片下方新增“游戏攻略”按钮。
- 新增“爆率查询”按钮。
- “游戏攻略”优先使用已有 `guideUrl` 字段；未配置时显示为不可用状态。
- “爆率查询”默认跳转到 `https://blcx.567zm.com/`。
- 如果后续为游戏配置了 `dropRateUrl`，详情页会优先使用该字段。

### 2. 后台预留爆率查询链接字段

修改文件：`src/pages/Admin.tsx`、`src/types/index.ts`

- 在游戏表单中新增“爆率查询链接”输入框。
- 在前端 `Game` 类型中新增可选字段 `dropRateUrl`。
- 新增、编辑游戏时会保存该字段，便于后续扩展单游戏爆率查询页面。

### 3. API 数据结构预留字段

修改文件：`server.js`

- `games` 表新增 `dropRateUrl` 字段。
- 新数据库会直接创建该字段。
- 已有 SQLite 数据库启动时会自动补充该字段，避免上线后保存失败。
- 新增和更新游戏接口均支持读写 `dropRateUrl`。

## 本地验证

已执行：

```bash
node --check server.js
git diff --check
npm.cmd run build
```

验证结果：

- API 服务端语法检查通过。
- 前端 TypeScript 与 Vite 生产构建通过。
- 构建产物输出到 `dist/`。

## 打包说明

本次本地构建产物会打包为 zip 文件，存放在 `.codex-tmp/` 目录，不提交到仓库。

## 注意事项

- GitHub Pages 工作流会在推送 `main` 后重新执行 `npm run build` 并部署 `dist/`。
- 后端 API 服务如果在线上独立部署，需要同步更新 `server.js` 并重启服务，才能支持 `dropRateUrl` 字段持久化。
