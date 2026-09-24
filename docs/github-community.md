# GitHub 个人榜与 MySQL

2026-09-24 上线。正式域名为 https://lavamilk.club，不带 www。

## 行为与模块

浏览者可查看个人榜及公开报告；登录后只能扫描自己的 GitHub 账户。服务端从 OAuth 验证后的数字用户 ID 确定身份，不接受客户端传入账户或分数。只允许 GitHub User，组织不能参榜。有效提交至少 20 条才显示在 Top 50 中。

最新完成报告决定个人排名，历次完成报告另存历史表。榜单不按时间过期，6 小时只是扫描缓存；刷新失败保留上一份报告。GitHub 改名后仍以数字 ID 识别个人。旧 SQLite 报告保留，并导入 `community_legacy_reports`，未经登录验证的旧记录不自动冒充个人上榜。

`server/community/index.js` 是服务模块的公开入口；SQL、OAuth、扫描和 AI 实现位于私有 `lib/`。`server/start.js` 负责进程启动；测试通过公开入口和替换上游网络访问验证行为。评分依赖现有 `pocketbase/pb_hooks/pig-king/index.cjs` 公开接口。依赖方向由 `.dependency-cruiser.cjs` 检查。PocketBase 原钩子属于历史兼容代码，生产 Nginx 将整个 `/api/pig-king/` 路径交给新 API，旧匿名扫描不会绕过登录限制。

授权采用 state、PKCE S256 和服务端交换 code，仅申请 `read:user`。GitHub 令牌只用于确认身份，不持久化或返回前端；站内随机会话在 MySQL 仅存哈希，Cookie 为 HttpOnly、Secure、SameSite=Lax，有效 7 天。POST 校验 Origin。参考 [GitHub OAuth 官方文档](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps)。公开活动读取使用可选服务端 `PIG_GITHUB_TOKEN`，不读取私有仓库。

## 配置 GitHub OAuth App

1. 打开 [创建 OAuth App](https://github.com/settings/applications/new)。Application name 可填 `Lavamilk Community`。
2. Homepage URL 填 `https://lavamilk.club`。
3. Authorization callback URL 必须为 `https://lavamilk.club/api/pig-king/auth/callback`。无需启用 Device Flow。
4. 创建后，把 Client ID 与生成的 Client Secret 填入宝塔 → Docker → 容器编排 → `lavamilk-community-db` 的环境变量文件，对应 `GITHUB_CLIENT_ID` 和 `GITHUB_CLIENT_SECRET`。保留原 MySQL 密码；不要把密钥放到聊天、仓库或 VITE 环境变量。
5. 保存编排并重新创建 API 容器，使环境变量生效。检查 `/api/pig-king/health` 中 `oauthConfigured: true`，然后通过官网实际授权、扫描、退出，再确认退出后无法扫描。

目前没有真实 App 凭据，登录按钮显示配置中。已测试模拟 GitHub 授权与真实 MySQL，真实 GitHub 授权还需上述步骤验收。

## 生产部署

配置通过宝塔维护，文件上传与服务检查通过 SSH。示例见 `ops/community/compose.yaml` 和 `env.example`，不含实际凭据。

| 项目 | 位置 |
| --- | --- |
| 宝塔编排 | `lavamilk-community-db` |
| 编排和环境文件 | `/www/server/panel/data/compose/lavamilk-community-db/` |
| MySQL 8.4 容器 | `lavamilk-community-db`，`127.0.0.1:13306` |
| 数据目录 | `/opt/lavamilk-community/mysql` |
| 数据库 | `lavamilk_community` |
| Node 22 API 容器 | `lavamilk-community-api`，`127.0.0.1:8091` |
| API 源码及依赖 | `/www/wwwroot/lavamilk.club/community` |
| 前端 | `/www/wwwroot/lavamilk.club/dist` |
| 原 CMS | `lavamilk-pb.service`，`127.0.0.1:8090` |
| 私有模型 | `127.0.0.1:18081/v1/chat/completions`，Gemma/llama.cpp |

API 部署包含 `server/` 及评分公开入口 `pocketbase/pb_hooks/pig-king/index.cjs`，运行 `npm ci --omit=dev --prefix server`。仅重启 API 即可更新代码。MySQL 数据目录独立于容器，重建容器不会清空排名；不要删除该目录。持久化并不代替备份，后续常规备份应使用 MySQL 一致性逻辑备份并在公开目录之外存放。

Nginx `location ^~ /api/pig-king/` 代理到 8091，读取超时 120 秒；该段关闭 access log，避免 OAuth code 进入 URL 日志。原 `/api/` 和 `/_/` 继续代理 PocketBase。数据库和模型端口均未向公网开放。

## 本地与验证

安装根目录及 server 依赖。准备独立 MySQL 数据库，设置 `DATABASE_URL`、`PUBLIC_ORIGIN=http://localhost:5173`；如测试真实登录，需另建本地 OAuth App，对应 localhost 回调。启动 `node server/start.js` 和 `npm run dev`。Gemma 环境变量见编排示例。

```sh
npm test
npm run lint:boundaries
npm run build
# 仅对专用空测试数据库运行；测试会写入虚构账户和报告。
TEST_DATABASE_URL='mysql://USER:PASSWORD@127.0.0.1:13306/EMPTY_TEST_DATABASE' npm test --prefix server
```

未设置 TEST_DATABASE_URL 时集成测试会跳过，不能算通过。实际已在服务器独立测试库完成：未登录拒绝、CSRF 与账户冒用拒绝、PKCE 与一次性 state、组织拒绝、完整扫描缓存、重启及半年后榜单保留、刷新失败保留报告、退出失效。上游 GitHub/AI 在测试中模拟，不消耗实际账号活动。

## 迁移与回滚

上线备份位于 `/www/backups/lavamilk/community-20260924/`：`nginx.before.conf`、`frontend.before.tar.gz`、`pocketbase.before.db`、`legacy.json`。原 SQLite 保留不删除。迁移脚本 `server/import-legacy.js` 从 JSON 报告数组幂等写入 MySQL 存档，不自动建立 OAuth 身份。

前端回滚先将备份解压到临时目录，恢复资源后原子替换入口。API 回滚前备份当前 MySQL，再恢复对应代码并重启 API。恢复旧 Nginx 会重新开放旧匿名扫描，应优先修复/回滚新 API 并维持登录门槛；若必须恢复旧站，需明确评估这项行为变化。不要覆盖生产数据或删除 MySQL 持久目录。
