# 沫凉的个人主页

毛玻璃卡片、动态背景、日夜切换、示例博客、联系栏，以及可切换成贪吃蛇的 Codex Token 活动图。页面下方的“沫凉ovo”使用 ZCOOL KuaiLe 艺术字体转成彩虹像素，支持拖动和方向键移动。

## 本机运行

- 安装：`npm ci`（Node.js 22）
- 开发：`npm run dev`，端口 3000
- 构建：`npm run build`，静态文件生成到 `out/`
- 预览：`npm start`，打开终端显示的本机地址
- 个人介绍、联系方式：`siteConfig.ts`；已配置邮箱、pueu GitHub 和 QQ
- 博客：`posts/*.md`；杂谈：`chatters/*.md`；关于页：`app/about/about.md`

## GitHub Pages

目标仓库：`pueu/moliang`。推送到 `main` 后，`.github/workflows/pages.yml` 自动构建并部署至 `https://pueu.github.io/moliang/`。

仓库已按所有者授权设为公开，Pages 发布来源已选择 **GitHub Actions**。

路径由构建环境中的 `GITHUB_PAGES_BASE_PATH` 和 `NEXT_PUBLIC_BASE_PATH` 设置，工作流已配置为 `/moliang`。换仓库名时，两处都要修改。构建后脚本兼容 Windows 上 Next.js 静态导出的路由数据文件路径。

## Codex 使用量接口

主页从 `https://moliang-codex-usage.omoliango.chatgpt.site/api/codex-usage` 读取统计。GitHub Actions 变量 `CODEX_USAGE_API_URL` 已配置为该公开 HTTPS 地址；页面每五分钟读取一次接口，手动刷新也只重读已同步的数据。接口允许 `https://pueu.github.io` 的 CORS GET。

NAS 采集器已准备为上海时间每日 12:00 同步。首次 NAS 官方 Codex 设备登录与首轮同步完成前，统计接口会显示暂无记录；电脑离线不会影响 NAS 的定时任务。接入与验证状态见 [USAGE-API.md](USAGE-API.md)。

网站不读取本机聊天记录，不捆绑用量快照，也不向浏览器提供登录凭据。未接入数据时贪吃蛇仍可游玩。

## 许可与素材

衍生前端采用 CC BY-NC 4.0，保留的许可与来源说明见 `LICENSE`。图片来源记录在 `ASSET-SOURCES.md`。技术栈为 Next.js 16、React 19、Tailwind CSS 4、Framer Motion。
