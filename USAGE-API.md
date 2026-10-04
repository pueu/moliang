# 官方 Codex 用量与 NAS 同步

个人 ChatGPT Plus 账号通过官方 Codex 原生 app-server 的 `account/usage/read` 读取云端每日汇总，不扫描本机会话文件，不导出登录凭据。官方原生进程只运行在自己的 NAS，不托管在公开接口中。

网站继续使用 GitHub Pages。外部 HTTPS 接口只保存 source、updatedAt、days（日期与 Token 数），其他字段不会入库。浏览器无凭据地读取 `/api/codex-usage`；NAS 使用独立上传密钥调用 `/api/ingest`，OpenAI 登录凭据不上传。

## 采集器

NAS 采集器固定使用官方 Codex CLI。认证状态保存在 NAS 受限目录；不复制电脑 `auth.json`。计划每天 Asia/Shanghai 12:00 采集一次，首次官方设备登录和首轮同步完成后生效。电脑离线不会影响已启动的 NAS 定时任务；NAS 无需公网 IPv4 或入站端口。失败时保留上一次成功汇总，页面展示采集时间。

目前采集器目录与密钥文件权限已在 NAS 上建立，镜像构建仍在进行，官方设备登录与首轮上传尚未完成。

## 前端配置

GitHub 仓库 Actions 变量 `CODEX_USAGE_API_URL=https://moliang-codex-usage.omoliango.chatgpt.site/api/codex-usage` 已配置。构建时传入 `NEXT_PUBLIC_CODEX_USAGE_API_URL`。接口允许 `https://pueu.github.io` 的 CORS GET。页面刷新按钮只重读已同步数据，不触发 NAS 采集。

官方返回的数据范围由服务端决定，`fetchedAt` 表示本次采集时间，不保证全天实时计数。

## 官方参考

- https://learn.chatgpt.com/docs/app-server#7-token-usage-chatgpt
- https://learn.chatgpt.com/docs/auth#login-on-headless-devices
