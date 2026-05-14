
# 管理后台修复功能 Implementation Plan

## [x] Task 1: 添加退出确认功能
- **Priority**: P2
- **Depends On**: None
- **Description**: 在closeModal函数中添加逻辑，检查是否有未保存的内容，显示确认提示
- **Acceptance Criteria Addressed**: AC-1
- **Test Requirements**:
  - human-judgment: 点击关闭时显示确认提示
- **Notes**: 使用confirm()函数检查

## [x] Task 2: 修复FileUploader组件 - 添加链接复制和状态显示
- **Priority**: P0
- **Depends On**: None
- **Description**: 修改FileUploader.tsx
  - 显示真实URL而不是仅显示状态
  - 添加复制链接按钮
  - 优化图片预览按原比例显示
- **Acceptance Criteria Addressed**: AC-2, AC-3
- **Test Requirements**:
  - human-judgment: 上传后可点击复制按钮
  - human-judgment: 图片预览无变形
- **Notes**: 同时更新UppyUploader和FilepondUploader保持一致

## [x] Task 3: 优化 FileUploader - 自动填充数据
- **Priority**: P0
- **Depends On**: Task 2
- **Description**: 
  - 上传游戏文件后，返回时携带filename和size信息
  - 在onChange回调中除了url之外，还能获取更多信息
  - 修改后端uploadToR2函数返回完整信息
- **Acceptance Criteria Addressed**: AC-4, AC-6
- **Test Requirements**:
  - human-judgment: 上传文件后大小和名字自动填充
- **Notes**: 需要协调前后端更改

## [x] Task 4: 更新后端API - 添加R2删除功能
- **Priority**: P0
- **Depends On**: None
- **Description**: 修改server.js添加删除R2文件的API
  - 添加DELETE /api/files/:path接口
  - 使用@aws-sdk/client-s3的DeleteObjectCommand
  - 修改deleteGame函数，先删除文件再删除数据库记录
- **Acceptance Criteria Addressed**: AC-9, AC-10
- **Test Requirements**:
  - human-judgment: 删除游戏后R2文件同时被删除
  - human-judgment: 删除后数据库中该游戏完全消失
- **Notes**: 先检查数据库确认删除，再删文件防止误删

## [x] Task 5: UI布局优化
- **Priority**: P1
- **Depends On**: None
- **Description**: 修改Admin.tsx和FileUploader.tsx
  - 去除overflow-y-auto等可能产生滑动栏的样式
  - 改进max-height限制
  - 使用flex布局优化响应式
- **Acceptance Criteria Addressed**: AC-7, AC-8
- **Test Requirements**:
  - human-judgment: 不同设备访问布局良好
  - human-judgment: 编辑按钮可正常点击
- **Notes**: 从浏览器开发者工具测试

## [x] Task 6: 下载量默认值×100
- **Priority**: P1
- **Depends On**: None
- **Description**: 
  - 修改createEmptyForm函数默认值
  - 或在API层处理
- **Acceptance Criteria Addressed**: AC-5
- **Test Requirements**:
  - human-judgment: 添加新游戏时下载量为×100的默认值
- **Notes**: 确认是否在前端或后端处理

## [x] Task 7: 集成所有改动并构建测试
- **Priority**: P0
- **Depends On**: Tasks 1-6
- **Description**: 
  - 整合所有修改
  - 本地测试
  - 构建并推送到GitHub
- **Acceptance Criteria Addressed**: All
- **Test Requirements**:
  - human-judgment: 所有功能正常工作
  - human-judgment: 构建成功
- **Notes**: 确保TypeScript类型正确
