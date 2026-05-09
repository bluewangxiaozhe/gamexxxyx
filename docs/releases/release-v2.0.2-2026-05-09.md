# Release v2.0.2 - 2026-05-09

## 基本信息
- **版本号**: v2.0.2
- **提交哈希**: 9367e01
- **日期**: 2026-05-09
- **分支**: master

## 构建产物
| 文件 | 大小 | Gzip |
|------|------|------|
| index.html | 0.90 KB | 0.61 KB |
| index-Cb24pm9V.css | 32.36 KB | 5.89 KB |
| index-BZJwEETV.js | 350.78 KB | 106.61 KB |

## 更新内容

### 新增文件
1. **`.env.development`** - 本地开发环境配置
   - `VITE_API_BASE=http://localhost:3000/api`

2. **`.env.production`** - 生产环境配置
   - `VITE_API_BASE=https://api.567zm.com/api`

3. **`server.js`** - 后端 API 服务
   - Express + mysql2 完整 CRUD
   - 管理员登录接口
   - 健康检查接口
   - **新数据库配置**: gamexxxyx/Gamexxxyx@2026@localhost:3306

### 修改文件
- **`.gitignore`** - 添加 api-package.json 排除

## 数据库配置（重要变更）

### 新凭据
- **主机**: localhost:3306
- **数据库**: gamexxxyx
- **用户**: gamexxxyx
- **密码**: Gamexxxyx@2026

### 管理员账号
- **用户名**: admin
- **密码**: Wang147#

## API 端点
- `GET /api/health` - 健康检查
- `GET /api/games` - 获取所有游戏
- `GET /api/games/:id` - 获取单个游戏
- `POST /api/games` - 创建游戏
- `PUT /api/games/:id` - 更新游戏
- `DELETE /api/games/:id` - 删除游戏
- `POST /api/admin/login` - 管理员登录
- `GET /api/admin/games` - 获取所有游戏（管理员）

## 测试清单
- [x] 前端构建成功
- [x] TypeScript 编译通过
- [x] Git 提交成功
- [x] GitHub 推送成功
- [ ] 本地 API 服务启动测试（需本地 MySQL）
- [ ] 生产环境部署验证

## Git 提交历史
```
9367e01 feat: 添加环境配置和后端API
6e2161a v2.0.1 源码恢复
```

## 下一步
1. Nginx 反向代理配置（api.567zm.com → localhost:3000）
2. SSL 证书部署
3. Cloudflare Pages 构建配置
4. 生产环境端到端测试
