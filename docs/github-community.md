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

2026-09-24 已通过 Safari 创建并配置 `lavamilkClub`（归属 `IwakuraRin`），在宝塔保存凭据并重建 API。健康接口已返回 `oauthConfigured: true`，真实 GitHub 授权后成功回到官网，显示登录账户 `iwakurarin`。应用未启用通配回调或 Device Flow；凭据仅留在服务器环境文件（权限 600），不写入仓库。

首次真实扫描已完成：`iwakurarin` 名下 1 个公开仓库，33 条有效提交、24 个 PR、0 个 Issues，得分 2，Gemma 双语总结状态为 `ready`，报告已持久保存并进入个人榜单。Safari 退出后恢复登录入口，重新登录可恢复会话。

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

## v4 历史扫描与毒舌审稿

扫描从 GitHub `created_at` 到任务开始日，涵盖本人在公开项目发表的提交、PR 和 Issues，以及名下公开仓库元数据。超过 1,000 个搜索命中的时间区间按 UTC 日期二分；每段按 100 条分页，SHA/URL 去重。单日超过 1,000、搜索返回 incomplete、分页缺漏都标为不完整。GitHub 无法提供的私有、删除、未收录数据和非默认分支提交不作完整覆盖承诺。

每类最多保留 10,000 条，最多 1,000 次搜索请求；全任务活动 JSON 有 8 MiB 容量保护。达到限制保留已读结果并标记 incomplete/limited。PR/Issue 正文和提交说明保留前 1,000 字符，长文本计入截断数；没有读取代码差异或评论全文。OAuth App 的服务端 Basic 凭据用于公开 API 额度，优先使用可选 PIG_GITHUB_TOKEN；密钥不进入 URL、前端或报告。GitHub 限流会保留任务，前端按等待时间自动续扫；未完成任务保留 7 天。模型加载/繁忙/网络临时失败时重试同一批（最多四次），不会立即跳过；AI 未完成的报告不阻止立即重扫。

AI 逐批阅读全部保留活动，每批最多 6 条、约 2,500 字符，输出带引用的观察；最终由覆盖各批的最多 12 条观察生成中英报告。它会尖锐吐槽具体写法，只有有证据的突出细节才夸，不凭提交数量、低分或技术名词套用赞美。缺失测试描述不能被解释为没有测试；不会声称看过未提供的 diff。GitHub 内容一律是不可信证据，不执行其中指令。页面分别显示 GitHub 读取量、AI 成功处理量、截断正文数和失败批数。固定统计评分不由模型改写。

v2 缓存不会阻止 v4 重扫，旧报告在完成新报告前保留；页面明确标记旧版 90 天样本。榜单读取只提取 tier，不加载整份历史 JSON。

新增真实 MySQL 集成场景验证 1,105 条跨年度提交的分段分页、旧 PR 正文、全部 1,107 条活动进入 AI 批处理、限流续扫，以及单日超过 1,000 时的显式不完整状态。

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
