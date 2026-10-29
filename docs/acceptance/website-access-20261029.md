# 官网访问优化验收记录

日期：2026-10-29。

## 变更范围

- 官网继续使用 `https://game.wangzhe.me`，API、数据库、安装包与地区下载规则保持原有配置。
- 移除 Google Fonts 与默认 Banner 的 Unsplash 请求，使用系统字体和现有渐变背景。
- 后台、列表和详情按路由加载；首张 Banner 提高优先级，封面按需加载。
- 公开 GET 不发送 JSON Content-Type 或后台令牌，后台读取和写入保留鉴权。
- 读取与登录校验限时 8 秒，覆盖响应正文；后台包检查等写入不套用读取期限。
- 下载清单失败后结束加载，界面显示中文错误；网络与解析错误保留原错误原因供诊断。
- `_headers` 仅配置带内容哈希的静态资源，不添加整站长期缓存。

## 本地检查结果

| 检查 | 实际结果 |
| --- | --- |
| `node scripts/check-frontend-api.mjs` | 16 项真实本地 HTTP 检查通过 |
| `node --check server.js` | 退出码 0 |
| `node scripts/check-launcher-api.mjs` | 113 项接口与历史数据库迁移检查通过 |
| `node scripts/check-launcher-release-form.mjs <Playwright路径> <Chrome路径>` | 67 项真实浏览器表单检查通过 |
| `npm run build` | TypeScript 与 Vite 构建通过 |
| `dist/_headers` | 只包含 `/assets/*` 的一年 immutable 缓存规则 |

请求检查先确认原实现会因多余 GET 请求头、持续等待与英文错误而失败，再验证修复。测试覆盖响应头等待、正文等待、登录等待、取消、连接中断、非法 JSON、清单并发复用与失败重试；8.5 秒的包检查仍可成功。

## 本地构建浏览器检查

将官网静态请求通过测试拦截指向本地构建，浏览器保留官网 Origin，API 与图片使用真实公开服务；没有执行生产写入。这项检查不代表正式官网已经发布本次文件。

- 桌面 1440×1000、手机 390×844 均没有横向溢出，系统字体、按钮和标题显示正常。
- 首页没有 Google 字体或 Unsplash 请求，没有下载后台、列表与详情的路由文件。
- 首图使用 eager/high，六张可见列表卡片声明 lazy/async。
- 游戏列表、真实游戏详情和后台登录页可以打开，导航保留，未点击下载或执行安装包。
- 公开读取没有 Content-Type、后台令牌和不必要 OPTIONS。
- 暂停游戏列表与更新清单请求后，8 秒期限内结束加载，显示中文超时与列表重试入口。
- 页面没有未捕获的 JavaScript 错误。

## 当前线上部署检查

- DNS 已指向 `game.wangzhe.me.eo.dnse4.com`；指定已解析的 EO 地址后，HTTPS 200，证书校验通过。
- 检查时线上仍为 `index-iNHv_d38.js`；JS 和 CSS 在 EO 命中缓存，首页 HTML 连续两次为 MISS。
- HTTP 首页当时返回 200，没有跳转到 HTTPS；该项需核对 EO 控制台的强制 HTTPS 配置。
- 公开 API 从官网 Origin 返回 200，CORS 来源匹配。
- 未读取 EO 控制台，不能从公开响应确认实际回源 Host、套餐或源站绑定设置。
- 本机存在连接超时与不同网络路径；结果不能代替大陆多地区、多运营商或晚间高峰验收。

## 提交与发布

- 仅提交本次代码、检查脚本和文档，排除用户已有 `test_online.py` 修改、未跟踪文件、环境配置与构建产物。
- 用户确认正式站需由 main 触发：推送 feature 后，将同一提交快进到 main，不改写历史。
- Pages 构建完成后分别检查 `pages.wangzhe.me` 与正式官网的入口资源名；EO 的缓存刷新与 HTTP 强制 HTTPS 属于独立配置检查。

## 正式发布验证结果

- 代码提交 `756a5b878922e42999a8c3d7e2fb6aa6eef15bb0` 已通过 feature 推送到 main，没有改写历史。
- GitHub 对该提交的 `Cloudflare Pages` 和 `deploy` 检查均为 completed/success。
- `pages.wangzhe.me` 与正式官网均返回 `index-DuGE4-xv.js`、`index-dPbIEZSl.css`。
- 从正式官网下载的 JS 与本地构建 SHA-256 一致：`FA820D30BC0CA99D5521C4B194E70D0F0F93C8B0F0740B74DA7A7519E7845524`。
- 新 JS 响应包含 `public, immutable, max-age=31536000`，重复读取为 EO HIT。
- 正式页面使用系统字体，无 Google Fonts、Unsplash 和首页后台路由文件请求；六张封面为 lazy/async，Banner 为 eager/high。
- 公开游戏数据成功显示，四项公开读取耗时约 78～85 毫秒，页面没有持续加载与控制台错误。这是本次浏览器样本，不代表全国速度。
- HTTP 强制 HTTPS 和首页 HTML 缓存仍属于控制台待核对项，没有在本次代码发布中修改。

## 未覆盖内容

没有执行图片派生处理、完整安装包吞吐测试、真实游戏启动、DNS 修改或服务商配置变更。构建显示原有 Browserslist 数据过期提示，本次未升级依赖。
