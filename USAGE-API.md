# Codex 使用量独立接口

GitHub Pages 只部署静态前端。本服务在记录 Codex 使用量的电脑上运行，使用独立端口 **8787**，每 5 分钟更新一次。需要 Node.js 22 或更高版本，无额外依赖。

```powershell
node scripts/codex-usage-api.mjs
```

默认只监听 `127.0.0.1:8787`。接口：

- `GET /health`：运行状态、最后更新时间，以及是否使用上一次成功的数据。
- `GET /api/codex-usage`：`updatedAt`、`source`、每日日期和 token 合计；不返回会话内容、会话 ID、文件路径或凭据。

接口按北京时间统计本机 Codex 会话文件里的累计计数变化，包含缓存输入。它是 token 活动记录，不代表套餐剩余额度或账单。扫描失败会继续返回最后一份有效数据；没有任何有效数据时返回 503。

## 接入 GitHub Pages

在有公网 HTTPS 反向代理或隧道的部署机器上设置：

```powershell
$env:USAGE_API_HOST = '127.0.0.1'
$env:USAGE_API_PORT = '8787'
$env:CORS_ORIGIN = 'https://pueu.github.io'
node scripts/codex-usage-api.mjs
```

将 HTTPS 域名的 `/api/codex-usage` 转发到本机 `http://127.0.0.1:8787/api/codex-usage`，然后在 GitHub 仓库 **Settings → Secrets and variables → Actions → Variables** 添加 `CODEX_USAGE_API_URL`，值例如 `https://usage.example.com/api/codex-usage`，重新运行网站部署。

GitHub Pages 页面使用 HTTPS，因此接口也应使用 HTTPS。若反向代理位于另一台机器，可明确设置 `USAGE_API_HOST=0.0.0.0`，并自行配置访问范围；本项目不会修改防火墙或开放外网端口。前端接口暂未配置或暂时不可用时显示静态快照，并标明数据状态。

## 可选设置

| 环境变量 | 默认值 | 用途 |
| --- | --- | --- |
| `USAGE_API_HOST` | `127.0.0.1` | 监听地址 |
| `USAGE_API_PORT` | `8787` | 独立端口 |
| `CORS_ORIGIN` | `http://localhost:3000,http://127.0.0.1:3000` | 允许的网站来源，多个来源用逗号分隔；不包含路径 |
| `CODEX_HOME` | 当前用户的 `.codex` | 本机 Codex 记录所在目录；部署到远程机器时须先提供记录 |
| `CODEX_USAGE_OUTPUT` | 项目内 `data/codex-usage.json` | 聚合快照保存位置 |

用 `Ctrl+C` 停止服务。尚未提供公网服务器或 HTTPS 域名时，以上仅为可运行的本机服务与部署说明，不代表外网接口已上线。
