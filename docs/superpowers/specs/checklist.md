# 文件上传功能 - 部署清单

## 部署前检查

### 环境要求
- [ ] Node.js >= 18.0.0
- [ ] npm >= 9.0.0

### 代码审查
- [ ] 所有代码变更已提交
- [ ] 无未解决的 lint 错误
- [ ] TypeScript 编译无错误

---

## 部署步骤

### 1. 后端部署（阿里云服务器）

```bash
# SSH 连接服务器
ssh root@60.205.113.19

# 进入项目目录
cd /opt/gamexxxyx-api

# 拉取最新代码
git pull origin main

# 安装新依赖
npm install @aws-sdk/client-s3 multer

# 重启服务
pm2 restart server
# 或
systemctl restart gamexxxyx-api
```

### 2. 前端部署

```bash
# 本地执行
npm run build
git push origin master:main
```

Cloudflare Pages 将自动部署。

---

## 验证清单

### 后端 API 验证
- [ ] `GET /api/health` 返回正常
- [ ] `POST /api/upload/game` 上传成功
- [ ] `POST /api/upload/cover` 上传成功
- [ ] `POST /api/upload/screenshot` 上传成功

### 文件存储验证
- [ ] R2 Bucket 可访问
- [ ] 文件路径正确 `/games/`, `/covers/`, `/screenshots/`
- [ ] 访问 URL 可正常下载/预览

### 前端验证
- [ ] 上传组件显示正常
- [ ] 拖拽上传功能正常
- [ ] 进度条显示正确
- [ ] 图片预览正常
- [ ] 删除/重新上传功能正常

---

## 回滚方案

### 如果出现问题：

**1. 后端回滚**
```bash
cd /opt/gamexxxyx-api
git revert HEAD
npm install
pm2 restart server
```

**2. 前端回滚**
```bash
git revert HEAD
npm run build
git push origin master:main
```

---

## 监控指标

### 上传成功率
- 目标: >= 99%
- 监控: 查看 API 日志中的错误率

### 上传速度
- 目标: 平均上传速度 >= 5MB/s
- 影响因素: 文件大小、网络速度

### R2 存储使用
- Bucket: wang
- 监控: Cloudflare Dashboard

---

## 维护计划

### 定期任务
- [ ] 每周检查 R2 存储使用情况
- [ ] 每月清理未引用的上传文件
- [ ] 定期更新依赖包版本

### 备份策略
- 数据库自动备份（已有）
- R2 文件无需备份（云端冗余）
