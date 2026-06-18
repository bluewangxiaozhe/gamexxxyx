# 版本发布记录 v2.1.0 - 2026-06-18

## 📦 版本信息

- **版本号:** v2.1.0
- **发布日期:** 2026-06-18
- **部署平台:** 前端 GitHub Pages（push main 自动部署）；后端自托管 Node 服务
- **构建产物:**
  - JS: 412.12 KB (gzip: 129.44 KB)
  - CSS: 35.73 KB (gzip: 6.31 KB)

---

## 🎯 本次更新内容

### 1. 国内 CDN 加速（线路自动切换）

**需求背景:** 文件存在 Cloudflare R2（`oss.wangzhe.me`），中国大陆访问慢。希望国内访客走腾讯 EdgeOne 加速域名 `down.567zm.com`，海外访客保持 R2 原始域名。

**解决方案:**
- 新增 `src/utils/region.ts`：
  - 通过 `https://oss.wangzhe.me/cdn-cgi/trace` 读取访客国家码（Cloudflare 自带接口），`loc=CN` 即判为中国大陆。
  - 结果按会话缓存（`sessionStorage`），整个会话只请求一次。
  - trace 不可用时回退到时区 + 语言启发式判断；默认 `global`（R2 全球可用，最安全）。
  - `toRegionUrl(url, region)`：仅替换我们自己的 R2 域名，外链（攻略、banner 图）原样不动。
  - 域名支持用前端环境变量 `VITE_R2_HOST` / `VITE_CN_HOST` 覆盖。
- 新增 `src/hooks/useRegion.ts`：组件读取当前地区。
- 在三处公开渲染套域名替换：`GameCard.tsx`、`FeaturedGames.tsx`、`GameDetail.tsx`（封面图 + 下载链接）。
- **数据库与上传逻辑不变**：文件仍以 R2 原始地址存储，后台管理页始终显示原始地址，仅前端渲染时按地区换域名。

**效果:**
- ✅ 国内访客下载链接与图片自动走 `down.567zm.com`
- ✅ 海外访客保持 `oss.wangzhe.me`
- ✅ 后台不受影响，单一数据源

### 2. 后端写接口鉴权（安全修复）

**问题:** 原来 `POST/PUT/DELETE /api/games` 和所有 `/api/upload/*` 接口零鉴权，任何人都能直接增删游戏、往 R2 上传文件。后台密码仅前端硬编码，拦不住直接打 API。

**解决方案:**
- `server.js`：新增 `ADMIN_TOKEN` 环境变量 + `requireAuth` 中间件（常量时间比较），保护所有写接口，未授权返回 401；未配置 `ADMIN_TOKEN` 时返回 503。
- 新增 `GET /api/auth/check` 供后台登录校验。
- 前端 `src/utils/api.ts`：token 存取函数 + 请求自动携带 `x-admin-token` + `checkAuth`。
- `Admin.tsx`：移除硬编码密码，登录改为调用服务端校验，登出清 token。
- `UppyUploader.tsx`：上传请求携带 token。

**效果:**
- ✅ 写接口需令牌，未授权被拒
- ✅ 后台密码即服务端 `ADMIN_TOKEN`，不再暴露在前端代码里

### 3. 清理与文档

- 删除未使用的上传组件 `FileUploader.tsx`、`FilepondUploader.tsx`，移除 `react-dropzone` 依赖（同步 `package-lock.json`）。
- 更正 `README.md`（技术栈改为 SQLite，补充 CDN 与鉴权说明）。
- 更新 `CHANGELOG.md` 至 2.1.0。
- 新增 `server.env.example` 说明服务端环境变量。

---

## 🧪 本地验证

```bash
npm run build       # tsc 类型检查 + vite 构建，通过
node --check server.js   # 后端语法检查，通过
```

浏览器实测（mock 后端驱动真实前端）：

| 验证项 | 结果 |
|---|---|
| 国内线路 - 封面图 / 下载链接 | → `down.567zm.com` ✅ |
| 海外线路 - 封面图 / 下载链接 | → `oss.wangzhe.me` ✅ |
| 登录 - 错误密码 | 显示「密码错误」，不存 token ✅ |
| 登录 - 正确密码 | 服务端校验通过，进入后台 ✅ |
| 控制台报错 | 无 ✅ |

---

## 🚀 部署步骤

### 前端（GitHub Pages，自动）

push 到 `main` 后，GitHub Actions（`.github/workflows/deploy.yml`）自动 `npm ci && npm run build` 并发布 `dist/`。

```bash
git push origin main
```

### 后端（手动覆盖 + 配置环境变量 + 重启）

> ⚠️ 本次后端**不只是替换 server.js**：新增了 `ADMIN_TOKEN` 环境变量，必须配置，否则所有写操作返回 503。
> 本次未新增依赖（`crypto` 是 Node 内置），**无需 `npm install`**。

1. 覆盖文件：
   ```powershell
   scp D:\Ai\gamexxxyx-v2-local\server.js root@your-server-ip:/opt/gamexxxyx-api/server.js
   ```
2. 在服务器 `/opt/gamexxxyx-api/.env` 中新增（参考 `server.env.example`）：
   ```
   ADMIN_TOKEN=你的强密码
   ```
   这个值就是后台新的登录密码。
3. 校验并重启：
   ```bash
   cd /opt/gamexxxyx-api
   node --check server.js
   systemctl restart gamexxxyx-api
   systemctl status gamexxxyx-api --no-pager
   ```

---

## ✅ 线上验证

1. 打开 `https://oss.wangzhe.me/cdn-cgi/trace`，国内网络应返回 `loc=CN`。
2. 国内访问官网，详情页「立即下载」链接域名应为 `down.567zm.com`。
3. 后台 `/#/admin` 用新密码登录；错误密码应被拒。
4. 未带令牌直接 `curl -X POST https://api.567zm.com/api/games` 应返回 401。

---

## ⚠️ 注意事项

- 前提：EdgeOne 域名 `down.567zm.com` 已配置且回源指向同一个 R2 桶、路径一致。
- 部署后端前务必先配好 `ADMIN_TOKEN`，否则后台无法保存/上传（503）。

**记录人:** 小王
**部署状态:** ⏳ 前端已推送 GitHub / 后端待手动更新
