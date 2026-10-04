# 官方 Codex 用量与 NAS 同步

个人 ChatGPT Plus 账号通过官方 Codex 原生 app-server 的 account/usage/read 读取云端每日汇总，不扫描本机会话文件，不导出登录凭据。官方原生进程仅运行于自己的 NAS，不托管在公开接口中。

网站继续使用 GitHub Pages。外部 HTTPS 接口只保存 source、updatedAt、days（日期与 Token 数），其他字段不会入库。浏览器无凭据地读取 /api/codex-usage；NAS 使用独立上传密钥调用 /api/ingest，OpenAI 登录凭据不上传。

## 采集器

NAS 原生 Codex 单独完成一次 codex login --device-auth。登录状态保存在 NAS 受限目录；不复制电脑 auth.json。每天 Asia/Shanghai 12:00 采集一次，首次登录后手动同步一次。电脑离线不影响任务，NAS 无需公网 IPv4 或入站端口。失败时保留上一次成功汇总，页面展示采集时间。

模块源代码见独立交付的 moliang-nas-collector；云端接收模块见 moliang-usage-api。部署配置、凭据与原生认证文件不提交 GitHub。

## 前端配置

GitHub 仓库 Actions 变量 CODEX_USAGE_API_URL=https://moliang-codex-usage.wintry-pine-3959.chatgpt.site/api/codex-usage。构建时传入 NEXT_PUBLIC_CODEX_USAGE_API_URL。接口允许 https://pueu.github.io 的 CORS GET。页面的刷新按钮只重读已同步数据，不触发 NAS 采集。

官方返回的数据范围由服务端决定，fetchedAt 表示本次采集时间，不保证全天实时计数。

## 官方参考

- https://learn.chatgpt.com/docs/app-server#7-token-usage-chatgpt
- https://learn.chatgpt.com/docs/auth#login-on-headless-devices
