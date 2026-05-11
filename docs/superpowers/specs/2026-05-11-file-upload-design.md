# 游戏管理后台 - 文件上传功能设计

## Why
当前后台添加游戏时，下载地址和封面图片只能手动输入 URL，用户体验不佳。需要实现拖拽上传功能，将文件存储到 Cloudflare R2，并支持文件预览和管理。

## What Changes

### 新增功能
1. **文件上传组件** - 支持拖拽上传和点击选择
2. **Cloudflare R2 集成** - 文件存储到 R2，分类管理
3. **上传进度显示** - 实时显示上传进度
4. **文件预览** - 图片预览、游戏包显示名称和大小
5. **文件管理** - 支持删除和重新上传

### 修改内容
- 后端：新增 R2 上传 API
- 前端：新增上传组件，修改 Admin 表单
- 数据库：无需变更（存储 URL）

## Impact

### 架构图
```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   前端      │───▶│   后端 API  │───▶│  R2 Storage │
│  Admin页面  │◀───│  Express    │◀───│   Bucket    │
└─────────────┘    └─────────────┘    └─────────────┘
                         │
                         ▼
                  ┌─────────────┐
                  │   MySQL     │
                  │   数据库     │
                  └─────────────┘
```

### 文件目录结构
```
R2 Bucket: wang
├── /games/        # 游戏安装包
│   └── {timestamp}_{filename}
├── /covers/       # 封面图片
│   └── {timestamp}_{filename}
└── /screenshots/  # 截图
    └── {timestamp}_{filename}
```

### 访问 URL
- 基础域名：`https://oss.wangzhe.me/`
- 游戏文件：`https://oss.wangzhe.me/games/xxx.apk`
- 封面图片：`https://oss.wangzhe.me/covers/xxx.jpg`
- 截图：`https://oss.wangzhe.me/screenshots/xxx.jpg`

## ADDED Requirements

### Requirement: 文件上传 API

#### Scenario: 上传游戏安装包
- **WHEN** 用户上传 .apk/.zip/.exe 文件
- **THEN** 文件保存到 `/games/` 目录
- **AND** 返回访问 URL

#### Scenario: 上传封面图片
- **WHEN** 用户上传图片文件
- **THEN** 文件保存到 `/covers/` 目录
- **AND** 返回访问 URL

#### Scenario: 上传截图
- **WHEN** 用户上传图片文件
- **THEN** 文件保存到 `/screenshots/` 目录
- **AND** 返回访问 URL

#### Scenario: 文件大小超限
- **WHEN** 上传文件超过限制
- **THEN** 返回 413 错误，提示文件过大

#### Scenario: 文件格式不支持
- **WHEN** 上传不支持的格式
- **THEN** 返回 400 错误，提示格式不支持

### Requirement: 前端上传组件

#### Scenario: 拖拽上传
- **WHEN** 用户拖拽文件到上传区域
- **THEN** 显示文件名和大小
- **AND** 开始上传并显示进度条

#### Scenario: 上传中
- **WHEN** 文件正在上传
- **THEN** 显示进度百分比和速度
- **AND** 禁用重新上传按钮

#### Scenario: 上传成功
- **WHEN** 文件上传完成
- **THEN** 显示预览（图片显示缩略图，文件显示名称和大小）
- **AND** 显示"删除"和"重新上传"按钮

#### Scenario: 上传失败
- **WHEN** 上传过程中出错
- **THEN** 显示错误信息
- **AND** 显示"重试"按钮

#### Scenario: 删除文件
- **WHEN** 用户点击删除按钮
- **THEN** 清空输入框
- **AND** 重置为上传状态

## File Specifications

### 支持的文件格式

#### 图片格式
| 格式 | MIME 类型 | 用途 |
|------|-----------|------|
| JPG/JPEG | image/jpeg | 封面、截图 |
| PNG | image/png | 封面、截图 |
| GIF | image/gif | 截图 |
| WebP | image/webp | 封面、截图 |
| SVG | image/svg+xml | 封面 |
| BMP | image/bmp | 截图 |

#### 游戏安装包格式
| 格式 | 说明 |
|------|------|
| APK | Android 应用 |
| IPA | iOS 应用 |
| EXE | Windows 可执行文件 |
| MSI | Windows 安装包 |
| DMG | macOS 磁盘镜像 |
| ZIP | 压缩包 |
| RAR | 压缩包 |
| 7Z | 压缩包 |
| TAR.GZ | 压缩包 |
| TAR | 压缩包 |

### 文件大小限制
| 类型 | 最大限制 |
|------|----------|
| 游戏安装包 | 1 GB (1073741824 bytes) |
| 封面图片 | 50 MB (52428800 bytes) |
| 截图 | 20 MB (20971520 bytes) |

## API Endpoints

### POST /api/upload/game

上传游戏安装包

**Request**
- Content-Type: `multipart/form-data`
- Body: `file` (binary)

**Response 200**
```json
{
  "success": true,
  "data": {
    "url": "https://oss.wangzhe.me/games/1715500000000_game.apk",
    "filename": "game.apk",
    "size": 104857600,
    "path": "/games/1715500000000_game.apk"
  }
}
```

**Response 400**
```json
{
  "success": false,
  "message": "不支持的文件格式"
}
```

**Response 413**
```json
{
  "success": false,
  "message": "文件大小超过限制 (最大 1GB)"
}
```

### POST /api/upload/cover

上传封面图片

**Request**
- Content-Type: `multipart/form-data`
- Body: `file` (binary)

**Response 200**
```json
{
  "success": true,
  "data": {
    "url": "https://oss.wangzhe.me/covers/1715500000000_cover.jpg",
    "filename": "cover.jpg",
    "size": 2097152,
    "path": "/covers/1715500000000_cover.jpg"
  }
}
```

**Response 400**
```json
{
  "success": false,
  "message": "不支持的图片格式"
}
```

**Response 413**
```json
{
  "success": false,
  "message": "图片大小超过限制 (最大 50MB)"
}
```

### POST /api/upload/screenshot

上传截图

**Request**
- Content-Type: `multipart/form-data`
- Body: `file` (binary)

**Response 200**
```json
{
  "success": true,
  "data": {
    "url": "https://oss.wangzhe.me/screenshots/1715500000000_ss.jpg",
    "filename": "screenshot.jpg",
    "size": 1048576,
    "path": "/screenshots/1715500000000_ss.jpg"
  }
}
```

**Response 413**
```json
{
  "success": false,
  "message": "图片大小超过限制 (最大 20MB)"
}
```

## Component Design

### FileUploader 组件

```
┌─────────────────────────────────────────┐
│  📁 拖拽文件到此处，或点击选择文件       │
│                                         │
│  支持格式：jpg, png, gif, webp, apk...   │
│  最大文件：1GB                          │
└─────────────────────────────────────────┘

上传中：
┌─────────────────────────────────────────┐
│  ████████████░░░░░░░░░  67%  2.3MB/s  │
│  game_v1.0.0.apk (120MB)                │
│  [取消]                                 │
└─────────────────────────────────────────┘

上传完成：
┌─────────────────────────────────────────┐
│  ✓ 上传成功                             │
│  📦 game_v1.0.0.apk (120MB)            │
│  [删除] [重新上传]                      │
└─────────────────────────────────────────┘

预览（图片）：
┌─────────────────────────────────────────┐
│  ✓ 上传成功                             │
│  ┌─────┐                               │
│  │ IMG │  screenshot.jpg (2.5MB)       │
│  └─────┘  [删除] [重新上传]             │
└─────────────────────────────────────────┘

错误状态：
┌─────────────────────────────────────────┐
│  ✗ 上传失败：网络错误                   │
│  game_v1.0.0.apk (120MB)               │
│  [重试]                                 │
└─────────────────────────────────────────┘
```

## R2 Configuration

### 连接信息
- Account ID: `14e1786491875d77c4748072f222204e`
- Access Key ID: `d846a04a9f5bdbffa32aba4fcc2e69c7`
- Secret Access Key: `***` (已隐藏)
- Bucket Name: `wang`
- 访问域名: `https://oss.wangzhe.me/`

### 权限配置
- Bucket 访问级别: 公共读取
- 上传权限: 通过后端 API（需要验证）

## Tech Stack

### 前端
- `react-dropzone` - 拖拽上传组件
- `axios` - HTTP 请求 + 上传进度
- Tailwind CSS - 样式

### 后端
- `multer` - 文件接收（内存存储）
- `@aws-sdk/client-s3` - R2 上传（S3 兼容协议）
- `express` - 现有后端扩展

## Dependencies

### 前端新增
```json
{
  "react-dropzone": "^14.2.3",
  "axios": "^1.6.0"
}
```

### 后端新增
```json
{
  "@aws-sdk/client-s3": "^3.500.0",
  "multer": "^1.4.5-lts.1"
}
```

## Testing Checklist

### 上传功能
- [ ] 上传 APK 文件成功
- [ ] 上传 ZIP 文件成功
- [ ] 上传 JPG 图片成功
- [ ] 上传 PNG 图片成功
- [ ] 超过大小限制提示错误
- [ ] 不支持格式提示错误
- [ ] 上传进度显示正确
- [ ] 上传取消功能正常

### 文件管理
- [ ] 删除已上传文件
- [ ] 重新上传文件
- [ ] 上传完成后 URL 正确填充

### 错误处理
- [ ] 网络断开时的错误提示
- [ ] 上传失败的重试机制
- [ ] 服务器错误的用户提示
