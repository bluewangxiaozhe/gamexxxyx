# API 生产服务器与部署说明

## 1. 当前生产服务概况

- 服务名称：`gamexxxyx-api.service`
- 启动方式：`systemd`
- 运行用户：当前进程由 `root` 拉起，工作目录内容所有者以 `gameapi:gameapi` 为主；后续如有条件，建议收口到专用服务用户
- Node 进程：`/usr/bin/node /opt/gamexxxyx-api/server.js`
- 工作目录：`/opt/gamexxxyx-api`
- 环境文件：`/opt/gamexxxyx-api/.env`
- 对外 API：`https://api.567zm.com/api`

## 2. systemd 服务配置

当前线上 `systemctl cat gamexxxyx-api.service` 结果如下：

```ini
[Unit]
Description=Gamexxxyx API Server
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/gamexxxyx-api
EnvironmentFile=/opt/gamexxxyx-api/.env
ExecStart=/usr/bin/node /opt/gamexxxyx-api/server.js
Restart=always
RestartSec=3
NoNewPrivileges=true

[Install]
WantedBy=multi-user.target
```

## 3. 部署目录现状

生产目录当前关键文件：

- `/opt/gamexxxyx-api/server.js`
- `/opt/gamexxxyx-api/package.json`
- `/opt/gamexxxyx-api/package-lock.json`
- `/opt/gamexxxyx-api/node_modules/`
- `/opt/gamexxxyx-api/.env`
- `/opt/gamexxxyx-api/server.js.bak.*`

说明：

- API 与前端 `dist/` 是分开部署的
- 线上 API 以 `/opt/gamexxxyx-api/package.json` + `node_modules` 运行，不依赖前端仓库根目录的 `package.json`
- 仓库中的 `api-package.json` 是“后端依赖清单参考”，线上当前实际使用的是 `/opt/gamexxxyx-api/package.json`

## 4. 当前线上依赖版本

`npm ls express better-sqlite3 multer cors dotenv @aws-sdk/client-s3 @aws-sdk/s3-request-presigner`
在 `/opt/gamexxxyx-api` 的实测结果：

- `express@5.2.1`
- `better-sqlite3@11.10.0`
- `multer@2.1.1`
- `cors@2.8.6`
- `dotenv@17.4.2`
- `@aws-sdk/client-s3@3.1067.0`
- `@aws-sdk/s3-request-presigner@3.1067.0`

## 5. 环境变量

以仓库里的 `[server.env.example](</D:/Ai/gamexxxyx-v2-local/server.env.example>)` 为准，生产至少要保证：

- `PORT`
- `DB_PATH`
- `CORS_ORIGIN`
- `ADMIN_TOKEN`
- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET_NAME`
- `R2_PUBLIC_URL`

注意：

- 不要把真实 `.env` 内容提交进仓库
- `ADMIN_TOKEN` 同时是后台登录密码和所有写接口令牌
- 如果令牌在终端、截图、聊天里暴露过，必须立即轮换并重启服务

## 6. 2026-07-06 已确认的线上状态

- `GET https://api.567zm.com/api/hero-banners` 已可读，返回 `[]`
- `GET /api/auth/check` 在携带正确 `ADMIN_TOKEN` 时返回 `{"success":true}`
- 说明 `hero_banners` 新接口已上线，鉴权链路正常
- 本轮未继续执行 Banner 写接口与后台页面实点联调

## 7. 标准上线步骤

适用于仅更新 API 的场景。

### 7.1 备份

```bash
cd /opt/gamexxxyx-api
cp server.js server.js.bak-YYYYMMDD-HHMMSS
```

如果本次改动涉及 `.env` 或数据库迁移，也要额外备份对应文件。

### 7.2 上传代码

最小变更优先只替换：

- `/opt/gamexxxyx-api/server.js`

如果依赖有变化，再同步更新：

- `/opt/gamexxxyx-api/package.json`
- `/opt/gamexxxyx-api/package-lock.json`

并执行：

```bash
cd /opt/gamexxxyx-api
npm install
```

### 7.3 重启服务

```bash
systemctl restart gamexxxyx-api.service
systemctl status gamexxxyx-api.service --no-pager
journalctl -u gamexxxyx-api.service -n 80 --no-pager
```

### 7.4 基础验收

```bash
curl -s https://api.567zm.com/api/health
curl -s https://api.567zm.com/api/hero-banners
curl -s -H "x-admin-token: <your-token>" https://api.567zm.com/api/auth/check
```

如本次改动涉及写接口，再补对应 `POST` / `PUT` / `DELETE` 联调。

## 8. 前端与 API 的部署边界

- 前端构建命令：`npm.cmd run build`（本地 Windows）
- 前端产物：`dist/`
- API 服务：服务器上的 `/opt/gamexxxyx-api/server.js`
- 二者可以分步上线

推荐顺序：

1. 先发 API
2. 确认接口可读 / 可鉴权
3. 再发前端 `dist`

这样可以避免前端先依赖新接口而 API 还没就绪。

## 9. 回滚步骤

如果新版 `server.js` 重启后异常：

```bash
cd /opt/gamexxxyx-api
cp server.js.bak-YYYYMMDD-HHMMSS server.js
systemctl restart gamexxxyx-api.service
systemctl status gamexxxyx-api.service --no-pager
```

如果问题来自 `.env` 或依赖升级，按同样思路回滚对应文件，再重启服务。

## 10. 后续建议

- 把 `hero_banners` 写接口和后台页面操作补一次生产联调
- 把公告也迁到服务端共享数据源，结束 `localStorage` 双轨
- 整理 `/opt/gamexxxyx-api/package.json` 与仓库 `api-package.json` 的差异，避免后续“本地参考”和“线上实跑”继续分叉
- 如条件允许，把服务用户、目录权限、日志策略再收口一轮
