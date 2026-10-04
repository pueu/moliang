# Codex 官方用量接口

主页从外部 HTTPS 服务读取统计，不读取本机会话日志、不捆绑快照、不生成示例用量。数据尚未接通时显示待接入状态，贪吃蛇仍可游玩。

## 官方数据源

[OpenAI 官方 App Server 文档](https://learn.chatgpt.com/docs/app-server#7-token-usage-chatgpt)提供 account/usage/read，返回 summary 和可选 dailyUsageBuckets。ChatGPT 登录可用，API-key-only 认证不适用。每日记录可能为 null，不能据此推算每日 Token 数量。此接口也不承诺涵盖普通 ChatGPT 网页的所有聊天。

GitHub Pages 只托管静态网页，因此官方登录和读取必须在另一个服务中完成。scripts/official-usage.mjs 使用官方 JSONL 协议，只调用 initialize、initialized、account/usage/read。它不访问 rollout 或聊天文件；只向网站返回日期、Token 总数、来源和获取时间。

## 运行外部转接服务

服务主机需安装支持该方法的 Codex CLI，并由账号所有者在该主机完成 ChatGPT 登录。登录材料留在主机上；不要提交到 GitHub 或填入 NEXT_PUBLIC 变量。

- 只读检查：npm run usage:check
- 运行：npm run usage:serve
- 默认绑定：127.0.0.1:8787；路径 /api/codex-usage
- 可配置：CODEX_BINARY、USAGE_API_HOST、USAGE_API_PORT、CORS_ORIGIN
- 默认允许的浏览器来源：https://pueu.github.io

通过已有 HTTPS 反向代理公开上述单一路径，不要暴露 Codex App Server 原始接口。每五分钟更新统计，失败返回 503，错误只返回类别，不返回账号信息或私密诊断。/health 仅证明 HTTP 服务启动，不代表官方数据读取成功。

## 网页配置

在仓库 Settings → Secrets and variables → Actions → Variables 添加 CODEX_USAGE_API_URL，值为完整公开 HTTPS 地址，然后重新部署。浏览器请求不带 Cookie 或 Authorization。接口返回：

    {
      "updatedAt": "接口获取时间 ISO 8601",
      "source": "OpenAI Codex · 官方账号用量",
      "days": [{ "date": "YYYY-MM-DD", "tokens": 123 }]
    }

以上只说明协议，不会作为网站数据。累计图显示接口中已返回的每日记录之和，不把有限历史标成账号终身总量。刷新失败时仅在当前页面内保留上次成功结果，并明确显示错误。

## 2026-10-04 验证状态

官方文档确认方法存在。现有执行环境启动 Codex 子进程退出，尚未获得账号每日统计，不能声称已接通。归一化测试验证了字段白名单、无每日桶时拒绝伪造记录，以及日期/计数验证。外部服务器和公开 HTTPS 地址尚待提供。

Tokscale 调研未采用：pueu 的公开资料接口返回 404，且服务响应未允许 GitHub Pages 跨域读取。没有向其上传数据或创建账号。
