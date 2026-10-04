# 沫凉的个人主页

毛玻璃卡片、动态背景、日夜切换、博客与杂谈、联系栏，以及可切换成贪吃蛇的 Codex Token 活动图。页面下方的“沫凉ovo”使用 ZCOOL KuaiLe 艺术字体转成彩虹像素，支持拖动和方向键移动。

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

主页仅从配置的外部 HTTPS 接口读取统计。官方 Codex App Server 的 `account/usage/read` 提供 Token 汇总和可选的每日记录；需要在外部服务中完成账号认证并转接统计。接入与验证状态见 [USAGE-API.md](USAGE-API.md)。

仓库 Actions 变量 `CODEX_USAGE_API_URL` 配置公开 **HTTPS** 用量接口。NAS 每天上海时间 12:00 同步 Codex 使用量；页面从公开接口读取上次已同步的数据，手动刷新不会触发 NAS 采集。临时错误时只在当前页面内保留上次成功的接口结果。

网站不读取本机聊天记录，不捆绑用量快照，也不向浏览器提供登录凭据。未接入数据时贪吃蛇仍可游玩。

## 许可与素材

衍生前端采用 CC BY-NC 4.0，保留的许可与来源说明见 `LICENSE`。图片来源记录在 `ASSET-SOURCES.md`。技术栈为 Next.js 16、React 19、Tailwind CSS 4、Framer Motion。
