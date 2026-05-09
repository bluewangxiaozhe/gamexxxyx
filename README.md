# 小小小游戏盒子官网 V2

> 现代极简风格的游戏下载平台

## 在线预览

- **官网**: https://bluewangxiaozhe.github.io/gamexxxyx


## 技术栈

- React 18 + Vite 5 + TypeScript
- Tailwind CSS + Framer Motion
- HashRouter（适配 GitHub Pages）
- MariaDB + Node.js API

## 本地开发

```bash
npm install
npm run dev
```

## 构建

```bash
npm run build
# 产物在 dist/ 目录
```

## 项目结构

```
src/
  components/    # 组件
  pages/         # 页面
  hooks/         # Hooks
  utils/         # 工具
  types/         # 类型定义
public/
  logo.png       # 网站 Logo
  favicon.ico    # 网站图标
```

## 管理后台

访问 `/#/admin`，默认密码：
- 用户名: `admin`
- 密码: `找我咨询`

## 更新日志

### v2.0.0
- 全新现代极简设计
- HashRouter 适配 GitHub Pages
- 完整增删改查管理后台
- Banner 轮播管理
- 搜索 + 分类过滤
