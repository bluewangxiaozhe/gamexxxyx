# 官网访问检查与前端优化计划

## 目标与范围

- 正式官网继续使用 `https://game.wangzhe.me`，检查新部署的 HTTPS、静态资源和公开 API。
- 修复已观察到的外部字体依赖、不必要预检、持续加载以及首屏加载后台代码的问题。
- 本次采用现有系统字体顺序，检查英文、数字、手机与桌面布局。
- 图片仅调整加载优先级和按需加载；原图派生处理、存储迁移、安装包线路和 DNS 不在本次代码变更范围。
- 用户已授权代码修改、GitHub 推送和通过 main 触发正式站发布；使用独立 feature 分支提交，验证后将同一提交合并进入 main，不包含原有未提交修改。

## 已观察证据

- 官网 DNS 已指向 `game.wangzhe.me.eo.dnse4.com`；单点连接存在超时，不能据此判定全国访问结果。
- 浏览器显示当前主 JS 仍为 `index-iNHv_d38.js`，Google Fonts 与 Unsplash 请求仍存在。
- 本次浏览器部分封面耗时约 8～40 秒，页面没有控制台错误。
- 公开 API 从官网来源可以成功读取。实际 EO 回源 Host、套餐与缓存规则尚未读取控制台。

## 文件与原因

| 文件 | 目的 |
| --- | --- |
| `index.html`、`tailwind.config.js`、`src/styles/index.css` | 取消 Google Fonts 依赖，沿用系统字体 |
| `src/App.tsx` | 后台、列表、详情按路由加载，保留页面导航 |
| `src/components/Hero.tsx`、`src/components/GameCard.tsx`、`src/components/DownloadCTA.tsx` | 首图优先、下方卡片按需加载和下载信息错误提示 |
| `src/utils/api.ts`、`src/hooks/useClientUpdate.ts` | 公开请求头、读取超时和后台请求兼容 |
| `public/_headers` | 带内容哈希资源的缓存，不添加全站长缓存 |
| 对应 `scripts/check-*.mjs` | 调用真实实现检查请求和加载行为 |
| 本文与验收记录 | 记录基线、执行结果与未验证范围 |

## 执行与验证

1. 检查线上入口和 Git 状态，记录已有用户修改；建立可以触发原问题的检查。
2. 增加针对真实请求实现的回归检查，确认修改前能够发现请求头与超时问题。
3. 完成前端改动，运行对应检查、现有真实 HTTP/SQLite 检查和生产构建。
4. 用本地浏览器验证首页、列表、详情和后台登录页，记录外部请求、路由资源与布局。
5. 审查差异与暂存内容，只提交本次文件；推送 feature 分支，将同一提交快进到 main，核对远端提交与自动部署状态。
6. 清理本次临时文件，汇报部署与代码各自的验证结果。

## 当前状态

代码与本地验证已完成，准备提交和推送。验证结果见 `docs/acceptance/website-access-20261029.md`。正式发布以 main 对应的 Pages 构建和官网实际资源为准。
