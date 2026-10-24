# 首页扭蛋机与音乐小房间

首页为静态 GitHub Pages，不新增后端接口，不修改 NAS 或 Codex 用量服务。桌面为扭蛋机与音乐房左右排列，音乐房下方保留黄历；手机纵向排列。博客、杂谈入口保留在导航中。

## 维护位置

- `components/toys/GachaMachine.tsx`：抽取与胶囊动画、结果弹窗。
- `components/toys/ToyCollection.tsx`：角色图鉴、剪影与重复数量。
- `components/toys/ToyDialog.tsx`：原生 dialog、Escape 关闭和键盘焦点循环。
- `components/toys/gachaState.ts`：每日配额、随机抽取、持久化和跨标签页串行保存。
- `components/toys/MusicRoom.tsx`、`spotifyEmbed.ts`：官方播放器、唱片、灯光及状态同步。
- `data/toyCharacters.ts`、`data/roomRecords.ts`：角色与歌曲的静态配置。
- `public/toys/`：本地角色原图及唱片封面；来源见 [TOY-ASSETS.md](TOY-ASSETS.md)。

## 扭蛋数据

浏览器 localStorage 的 `moliang:toy-gacha:v1` 一次保存 `{version, day, used, collection, lastDraw}`。Shanghai 日期通过 `Intl.DateTimeFormat` 的 `Asia/Shanghai` 时区计算。新的一天只重置 used，不清空收藏，不累积次数。每次用 `crypto.getRandomValues` 在 8 个等概率区间抽取，允许重复。

先保存完整快照并读回确认，再展示已收藏结果。读取损坏记录时保留原数据并提示；写入被禁用或超额时明确提示未确认保存，不展示保存成功。刷新后可重新打开上次收获。

Web Locks 负责同源标签页互斥；不支持时使用 IndexedDB 的 readwrite 事务串行执行 localStorage 的同步读改写。storage 事件同步其他标签页，页面回到前台及定时检查时刷新当日次数。此机制仅为访客自己的浏览器记录，没有登录、跨设备同步或服务器防刷；清理站点数据会清空次数和收藏。

## 音乐

首次操作之后才加载 `https://open.spotify.com/embed/iframe-api/v1`，官方 iframe 始终可见。音乐只由 Spotify 播放，不从旧 `/api/music` 取流，也不解析或代理歌曲。

唱片与摆件只在 `playback_update` 表明 `!isPaused && !isBuffering` 时运动，暂停、缓冲、错误时停止；状态消息中断也会停止动画。切歌使用官方 `loadEntity`（兼容旧版 `loadUri`），等待 ready 后按需要继续播放。自定义播放暂停按钮使用官方 `togglePlay`，兼容未登录的试听播放器。加载超时、SDK 错误提供重试和 Spotify 平台入口。午后/夜晚仅修改音乐房内部灯光。减少动态效果偏好会关闭装饰动画。

试听与完整版的可用性由 Spotify 的地区、账号、浏览器和授权决定。平台入口始终保留，不承诺匿名完整播放。

官方接口参考：

- https://developer.spotify.com/documentation/embeds/references/iframe-api
- https://developer.spotify.com/documentation/embeds/tutorials/troubleshooting

## 构建与回归

```powershell
$env:NEXT_TELEMETRY_DISABLED='1'
$env:GITHUB_PAGES_BASE_PATH='/moliang'
$env:NEXT_PUBLIC_BASE_PATH='/moliang'
# 保留当前部署的 CODEX_USAGE_API_URL 配置，不提交账户凭据。
npm run build
node --test scripts/gacha.test.cjs scripts/breakout.test.cjs scripts/usage-summary.test.cjs
```

静态构建成功，以上 15 项测试通过。全库 `tsc --noEmit` 存在原有的 4 项错误（`app/chatter/page.tsx` 的隐式 any 和 `components/SiteDashboard.tsx` 的空数组推断），本次新增文件无类型错误。

浏览器测试脚本 `scripts/gacha.browser.js`、`scripts/music-room.browser.js` 是 Playwright CLI 的 `run-code --filename=...` 输入函数。先启动静态预览在 `http://127.0.0.1:3100/moliang/`，建立一个隔离浏览器会话并创建 `.artifacts/`，再执行脚本。测试只改变隔离浏览器中的收藏数据。音乐脚本用 SDK 事件夹具验证缓冲和错误，不代表真实平台音频验收；真实 Spotify 另行实测。

已验证：上海零点、三次限额、重复收藏、刷新恢复、两个标签页竞争最后一次、无 Web Locks 时四个标签页同时抽取仅保存三次、存储失败提示、图鉴剪影、键盘焦点、减少动态效果、手机纵向布局、SDK 首次点击加载、播放状态与动画同步、失败重试和平台入口。

2026-10-24 在隔离 Edge 会话实测真实 Spotify：普通朋友播放/暂停可驱动或停止唱片动画；下一首加载愛, 很簡單，再下一首加载三人遊；上一首返回前一首；官方界面显示“试听”，平台完整版链接随曲目变化。切歌后浏览器有时要求再次点击播放，此时房间保持静止并提示点击播放器，不假装自动播放。模拟 SDK 测试另行覆盖缓冲、网络失败和成功重试。
