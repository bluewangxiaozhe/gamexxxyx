
# 管理后台修复功能 Product Requirement Document

## Overview
- **Summary**: 修复管理后台多项功能缺陷，包括添加/编辑游戏页面的用户体验优化、上传组件增强、数据同步问题修复等
- **Purpose**: 解决用户反馈的多个问题，提升管理后台的易用性和功能完整性
- **Target Users**: 游戏后台管理员

## Goals
1. 修复编辑按钮不可点击问题
2. 优化添加/编辑游戏页面的用户体验
3. 增强文件上传功能（添加链接复制、文件名保留、图片预览优化）
4. 改进数据自动填充（大小、下载量、游戏名）
5. 优化UI布局，避免滑动栏和错位问题
6. 修复R2文件删除和数据库删除完整性问题
7. 添加退出确认功能

## Non-Goals (Out of Scope)
- 不重构整个应用架构
- 不改变现有数据库结构
- 不添加用户权限管理

## Background & Context
根据用户反馈，当前管理后台存在以下问题：
1. 编辑按钮点击无反应
2. 添加游戏页面易误触滑动退出
3. 上传后无法看到/复制真实链接
4. 文件名丢失，仅显示状态
5. 封面图片预览比例失真
6. 文件大小、下载量、游戏名未自动填充
7. UI存在滑动栏，不同设备易错位
8. 删除R2文件和游戏数据未完整处理
9. 退出前无确认提示

## Functional Requirements
- **FR-1**: 添加游戏编辑状态时退出需确认提示
- **FR-2**: 上传后显示真实链接并提供复制功能
- **FR-3**: 封面图片按原比例缩放预览
- **FR-4**: 上传游戏文件后自动填充大小
- **FR-5**: 下载量自动设置为实际下载量×100
- **FR-6**: 根据上传文件名自动填充游戏名称
- **FR-7**: UI优化，去除滑动栏，自适应布局
- **FR-8**: 修复编辑按钮点击无反应问题
- **FR-9**: 删除时同时删除R2上的文件
- **FR-10**: 确认数据库完整删除游戏数据

## Non-Functional Requirements
- **NFR-1**: UI响应式适配，兼容各种屏幕尺寸
- **NFR-2**: 加载状态友好提示
- **NFR-3**: 操作流程清晰简单

## Constraints
- **Technical**: 基于React + TypeScript + Tailwind CSS，后端Express.js + Cloudflare R2
- **Business**: 保持现有API接口不变
- **Dependencies**: 依赖现有useGames hooks、api模块

## Assumptions
- 浏览器支持现代JavaScript特性
- Cloudflare R2 S3兼容API正常
- 数据库连接稳定

## Acceptance Criteria

### AC-1: 退出确认提示
- **Given**: 用户在添加/编辑游戏页面（有未保存内容）
- **When**: 点击关闭或取消按钮
- **Then**: 显示确认提示框
- **Verification**: human-judgment

### AC-2: 链接复制功能
- **Given**: 用户上传文件后
- **When**: 点击复制链接按钮
- **Then**: 链接复制到剪贴板并提示成功
- **Verification**: human-judgment

### AC-3: 图片比例预览
- **Given**: 上传封面图片后
- **When**: 查看预览
- **Then**: 图片按原始比例显示，不失真
- **Verification**: human-judgment

### AC-4: 大小自动填充
- **Given**: 用户上传游戏文件后
- **When**: 文件上传成功
- **Then**: 大小字段自动填入（例如：500MB）
- **Verification**: human-judgment

### AC-5: 下载量自动设置
- **Given**: 用户添加新游戏
- **When**: 设置下载量
- **Then**: 默认值为实际下载量×100
- **Verification**: human-judgment

### AC-6: 游戏名自动填充
- **Given**: 用户上传游戏文件
- **When**: 文件上传成功
- **Then**: 游戏名字段自动填入文件名（去除扩展名）
- **Verification**: human-judgment

### AC-7: UI布局优化
- **Given**: 用户使用不同设备访问后台
- **When**: 查看添加/编辑游戏页面
- **Then**: 无滑动栏，布局自适应无错位
- **Verification**: human-judgment

### AC-8: 编辑按钮修复
- **Given**: 用户查看游戏列表
- **When**: 点击编辑按钮
- **Then**: 正常打开编辑页面
- **Verification**: human-judgment

### AC-9: R2文件删除
- **Given**: 用户删除游戏
- **When**: 确认删除后
- **Then**: 对应R2文件同时被删除
- **Verification**: human-judgment

### AC-10: 数据库完整删除
- **Given**: 用户删除游戏
- **When**: 确认删除后
- **Then**: 数据库中该游戏数据完全删除
- **Verification**: human-judgment

## Open Questions
- [ ] 是否在添加时删除旧文件？

