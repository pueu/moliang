# 沫凉的个人主页

毛玻璃卡片、动态背景、日夜切换、可拖动的彩虹像素标题“沫凉ovo”、示例博客、联系栏，以及可切换成贪吃蛇的 Codex Token 活动图。

## 本机运行

- 安装：`npm ci`（Node.js 22）
- 开发：`npm run dev`，端口 3000
- 构建：`npm run build`，静态文件生成到 `out/`
- 预览：`npm start`，打开终端显示的本机地址
- 个人介绍、联系方式：`siteConfig.ts`；邮箱、GitHub、QQ 暂留空
- 博客：`posts/*.md`；杂谈：`chatters/*.md`；关于页：`app/about/about.md`

## GitHub Pages

目标仓库：`pueu/moliang`。推送到 `main` 后，`.github/workflows/pages.yml` 自动构建并部署至 `https://pueu.github.io/moliang/`。

首次部署需在仓库 Settings → Pages → Build and deployment 中选择 **GitHub Actions**。私有仓库需要当前账号套餐支持 Pages；仓库可见性不会被本项目自动修改。

路径由构建环境中的 `GITHUB_PAGES_BASE_PATH` 和 `NEXT_PUBLIC_BASE_PATH` 设置，工作流已配置为 `/moliang`。换仓库名时，两处都要修改。构建后脚本兼容 Windows 上 Next.js 静态导出的路由数据文件路径。

## Codex 使用量接口

`npm run usage:serve` 启动独立接口，默认 `127.0.0.1:8787`。详见 [USAGE-API.md](USAGE-API.md)。它读取本机 Codex 使用量记录，只输出每日汇总数字。

把公开 **HTTPS** 接口完整地址填入仓库 Settings → Secrets and variables → Actions → Variables 中的 `CODEX_USAGE_API_URL`，然后重新运行部署工作流。页面每五分钟刷新接口；未配置或离线时展示构建内的快照，并显示数据时间。

`npm run usage:sync` 可手动刷新快照。GitHub 构建不会读取本机聊天记录。当前快照只含日期和 Token 汇总。

## 许可与素材

衍生前端采用 CC BY-NC 4.0，保留的许可与来源说明见 `LICENSE`。图片来源记录在 `ASSET-SOURCES.md`。技术栈为 Next.js 16、React 19、Tailwind CSS 4、Framer Motion。
