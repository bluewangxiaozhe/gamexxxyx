# 游戏列表显示问题调试

## Why
前端网站 https://gamexxxyx.pages.dev 无法显示游戏列表，需要检查 API 配置和数据流。

## What Changes

### 发现的问题

1. **API 返回格式不匹配**
   - 前端 `api.ts` 期望返回 `ApiResponse<T>` 对象
   - 后端 `server.js` 直接返回数组 `res.json(rows)`

2. **后端服务未部署**
   - `server.js` 仅存在于本地项目
   - 未部署到阿里云服务器 `/opt/gamexxxyx-api/`

3. **API 地址配置**
   - 前端生产环境指向 `https://api.567zm.com/api`
   - 需要确认服务器是否正确配置 Nginx 反向代理

## Impact
- 前端无法获取游戏数据，显示"暂无游戏"
- 影响用户浏览体验

## ADDED Requirements

### Requirement: 修复 API 返回格式
前端 API 请求函数需要兼容直接返回数组的格式

#### Scenario: API 返回数组格式
- **WHEN** 前端调用 `api.getGames()`
- **THEN** 应该正确处理后端返回的数组，而不是期望的 `{success: true, data: [...]}`

### Requirement: 确认后端部署状态
后端服务需要在阿里云服务器上正确部署和运行

#### Scenario: API 服务健康检查
- **WHEN** 访问 `https://api.567zm.com/api/health`
- **THEN** 返回 `{status: 'ok', db: 'connected'}`

## MODIFIED Requirements

### Requirement: API 配置
**修改前**: API 返回 `{success: true, data: [...]}`
**修改后**: API 直接返回数组 `[{...}, {...}]`

## REMOVED Requirements
无
