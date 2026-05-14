
# 管理后台完整修复 Spec

## Why
管理后台存在多个未完全实现的功能，包括编辑按钮无效、自动填充缺失、UI布局问题等，需要全面修复以确保功能正常使用。

## What Changes
- 修复编辑按钮功能，确保可正常编辑已添加的游戏
- 彻底去除添加游戏页面的滚动条问题
- 完整实现自动填充功能（文件名、大小等）
- 仅保留Uppy上传组件，移除其他上传选项
- 深度优化添加游戏UI体验
- 增强UppyUploader组件，添加复制链接功能
- 修复FileUploader组件的缺失功能
- 修复下载量默认值问题

## Impact
- Affected specs: 管理后台游戏管理
- Affected code: [Admin.tsx](file:///d:/Ai/gamexxxyx-v2-local/src/pages/Admin.tsx), [UppyUploader.tsx](file:///d:/Ai/gamexxxyx-v2-local/src/components/UppyUploader.tsx), [FileUploader.tsx](file:///d:/Ai/gamexxxyx-v2-local/src/components/FileUploader.tsx)

## ADDED Requirements
### Requirement: 完整的文件上传组件
系统 SHALL 提供功能完整的Uppy上传组件，包括：
- 上传后显示真实链接
- 一键复制链接功能
- 图片按原比例预览
- 显示文件名和大小

#### Scenario: Success case
- **WHEN** 用户上传文件成功
- **THEN** 显示文件信息、真实链接、复制按钮

### Requirement: 自动填充功能
系统 SHALL 在用户上传游戏文件后自动填充：
- 游戏名称（去除扩展名）
- 文件大小（自动格式化）

#### Scenario: Success case
- **WHEN** 用户上传游戏文件
- **THEN** 游戏名称和大小字段自动填充

### Requirement: 单一上传组件
系统 SHALL 仅保留Uppy上传组件，移除其他上传选项。

#### Scenario: Success case
- **WHEN** 用户打开添加/编辑游戏页面
- **THEN** 只看到Uppy上传组件，无上传组件切换选项

## MODIFIED Requirements
### Requirement: UI布局优化
添加/编辑游戏Modal SHALL 使用优化的布局：
- 无整体滚动条，仅内容区域滚动
- 响应式设计，适配不同设备
- 清晰的视觉层次和间距

## REMOVED Requirements
### Requirement: 多上传组件切换
**Reason**: 用户反馈只需要Uppy组件，简化界面
**Migration**: 移除上传组件切换UI，固定使用Uppy
