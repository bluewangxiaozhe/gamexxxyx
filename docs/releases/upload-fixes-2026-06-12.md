# 上传功能修复记录 - 2026-06-12

## 修复概述

本次修复针对后台上传组件和 API 上传服务，主要解决两个问题：

- 后台上传成功后，“复制链接”按钮没有和链接显示框对齐。
- 上传中文文件名到 Cloudflare R2 后，R2 后台对象名显示为乱码。

## 修改内容

### 1. 后台上传链接区域对齐

修改文件：`src/components/UppyUploader.tsx`

- 固定链接显示框高度。
- 固定“复制链接”按钮高度。
- 桌面端让按钮和链接框底部对齐。
- 移动端自动上下排列，避免挤压。
- 链接显示时会把 URL 中的中文路径解码成可读文本。
- 复制按钮仍然复制真实可访问 URL，不影响打开和分享。

### 2. R2 中文文件名处理

修改文件：`server.js`

- 上传时先修复 multipart 文件名编码，避免中文文件名变成乱码。
- 文件名清洗时保留中文，只替换路径分隔符、控制字符等危险字符。
- 返回给前端的公开 URL 会对路径做安全编码，保证浏览器可以访问。
- R2 对象路径仍保留可读中文文件名。

## 本地验证

已执行：

```bash
npm.cmd run build
node --check server.js
```

验证结果：

- 前端构建通过。
- API 服务端语法检查通过。

## 服务器更新步骤

将本地新版 API 文件覆盖到服务器：

```powershell
scp D:\Ai\gamexxxyx-v2-local\server.js root@your-server-ip:/opt/gamexxxyx-api/server.js
```

然后在服务器执行：

```bash
cd /opt/gamexxxyx-api
node --check server.js
systemctl restart gamexxxyx-api
systemctl status gamexxxyx-api --no-pager
```

## 线上验证方式

上传一个中文文件名的测试图片，例如：

```bash
curl -F "file=@/root/剑引外传.png" https://api.567zm.com/api/upload/cover
```

预期结果：

- 返回的 `filename` 保留中文文件名。
- 返回的 `url` 可以在浏览器中正常打开。
- R2 后台对象名显示为正常中文，不再是乱码。
- 后台上传组件中的链接显示区域可读，并且“复制链接”按钮对齐。

## 注意事项

- 前端显示链接时会解码 URL，便于人工查看。
- 点击“复制链接”时仍复制原始 URL，保证链接可直接访问。
- 如果线上仍显示旧行为，需要确认服务器上的 `/opt/gamexxxyx-api/server.js` 是否已经覆盖并重启服务。
