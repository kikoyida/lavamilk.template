# Lavamilk 线上部署

更新于 2026-09-23，发布编号 `20260923T1546`。

## 地址和管理

- 正式地址：`https://lavamilk.club`，仅绑定不带 www 的域名。
- 宝塔 → 网站 → HTML 项目 → 备注「Lavamilk 官网」。面板内部项目名仍为 `www.lavamilk.club`，这是创建时的标识，不是当前绑定域名；域名管理中只有 `lavamilk.club`。
- 本次域名、HTTPS、API 代理配置和旧配置停用均通过宝塔网页完成；文件发布和服务重载通过 SSH 完成。
- 服务器：`45.192.97.209`。此文档不保存登录凭据。

## 路径

| 用途 | 位置 |
| --- | --- |
| 网页根目录 | `/www/wwwroot/lavamilk.club/dist` |
| 前端源码 | `/www/wwwroot/lavamilk.club/app` |
| PocketBase、数据、钩子和迁移 | `/www/wwwroot/lavamilk.club/pb` |
| 后端服务 | `lavamilk-pb.service`，仅监听 `127.0.0.1:8090` |
| 宝塔管理的 Nginx 配置 | `/www/server/panel/vhost/nginx/html_www.lavamilk.club.conf` |
| 已停用的旧配置 | `/www/server/panel/vhost/nginx/lavamilk.club.conf.predeploy-20260923` |
| 日志 | `/www/wwwlogs/lavamilk.club.log`、`/www/wwwlogs/lavamilk.club.error.log` |
| 证书 | `/etc/letsencrypt/live/lavamilk.club/` |
| 发布与备份 | `/www/backups/lavamilk/20260923T1546/` |

证书仅包含 `lavamilk.club`，当前有效期至 2026-12-22。已有 `certbot.timer` 自动续期，使用网页根目录验证，成功后重载 Nginx；本次保留了该机制。宝塔列表已识别证书，显示剩余 89 天。

## 本次发布

前端先复制资源，再原子替换 `index.html`；保留旧哈希资源供已打开的页面继续访问。保留 `.well-known` 和宝塔锁定的 `.user.ini`。后端只新增猪猪榜钩子和 `1790160000_pig_scores.js` 迁移，不替换现有数据库。

备份目录包含 `frontend-before.tar.gz`、停服期间生成的 `pocketbase-before.tar.gz`、`nginx-before.conf`、服务文件备份、发布包及 `staging/`。发布包 SHA-256：`edff37781ed9b25617a5cd2469c10adca23f6304cd6dc203678332a7aae9881f`。

高清无水印表情包为 `/images/pig-score-meme-hd.png`；旧水印图未包含在此次发布包中。保留 Google Noto 猪猪 SVG 的许可文件 `/emoji/LICENSE.txt`。

## 验证结果

- HTTP 自动跳转到 `https://lavamilk.club`，HTTPS 证书验证通过。
- 线上入口文件、高清图片与本地构建逐字节一致，入口 JS/CSS 和许可文件返回 200。
- Nginx 检查通过，无重复站点警告；PocketBase 服务和健康接口正常。
- 原 CMS 数据数量保持：settings 1、features 6、tiers 3、faqs 3、changelog 4。
- 内置浏览器验证社区菜单、留空禁用的 lavapiggy 入口、全宽猪猪榜、高清图及双语文案。
- 实际扫描 `lavamilkTeam/LavamilkSMT` 成功：9 条提交、7 条有效、得分 4；不足 20 条未上榜。再次请求命中缓存。

## 2026-09-24 账户榜单更新

发布编号 `20260924T0516`，备份目录 `/www/backups/lavamilk/20260924T0516/`。`frontend-before.tar.gz` 与 `pocketbase-before.tar.gz` 保留此次更新前的页面及数据库；新发布包为 `release-final.tar.gz`，SHA-256 为 `249700cdf8a0c162ba69a2dff408f62f613cf58a3a42a66ebf82ef96588bc9c0`。

新增账户扫描、仓库分页、公开 PR/Issue 样本、账户榜单及双语 AI 报告接入；新增 `1790208000_pig_accounts.js` 迁移。旧仓库接口、旧榜单数据和 CMS 保留。域名、Nginx、SSL 与 systemd 配置均未变更。

18 项测试、构建和 diff 检查通过。线上入口与构建一致，真实扫描 `lavamilkTeam` 返回 2 个仓库、21 条有效提交、24 个 PR、0 个 Issues，得分 3，已进入账户榜单。此轮发布时 AI 尚未启用；后续接入结果见下一节。

## 2026-09-24 Gemma 私有隧道

经用户授权，Proxmox 本地配置通过 SSH，生产端专用公钥与 PocketBase 环境变量通过宝塔文件编辑器配置。生产原有两套 FRP 服务未改动，本链路使用 SSH，不经过 FRP。

- Proxmox `192.168.188.3`：`lavamilk-gemma-tunnel.service` 开机自启，失败后每 10 秒重连，30 秒心跳、连续 3 次无响应断开重试。
- VM 102：`192.168.2.5:8080`，`gemma.service` / llama.cpp，模型 `gemma-4-12b`。
- 官网服务器：反向转发仅监听 `127.0.0.1:18081`。PocketBase 使用 `/v1/chat/completions`，provider 为 `llamacpp`，关闭思考、要求 JSON；不需要公网模型端口或 API key。
- 专用私钥仅存于 Proxmox `/root/.ssh/lavamilk-gemma`；固定验证云服务器主机公钥。生产 authorized_keys 限制该密钥的监听/连接地址为 `127.0.0.1:18081`，禁止 shell、PTY、agent 和 X11。
- 配置备份：`/www/backups/lavamilk/gemma-20260924/`，包含原 authorized_keys、原后端 service 与重新扫描前的数据库备份。
- 断线恢复测试通过：终止隧道主进程后 systemd 自动重启（NRestarts=1），云端模型健康检查恢复；专用密钥执行命令被拒绝。
- 实际扫描 `lavamilkteam` 成功：21 条有效提交、24 个 PR，AI 状态 `ready`，中英文各生成总结与引用来源，AI 阶段约 59 秒。仅刷新该测试账户原先未启用 AI 的缓存。

运维：在 Proxmox 使用 `systemctl status lavamilk-gemma-tunnel` 和 `journalctl -u lavamilk-gemma-tunnel`；在云端用 `curl http://127.0.0.1:18081/health` 检查模型链路。模型生成最多等待 90 秒，繁忙或断网时保留统计并显示暂时无法总结；报告仍缓存 6 小时。

回滚模型连接时，先在宝塔恢复后端 service 备份并重载/重启后端，再停用 Proxmox 隧道服务，仅移除本次专用公钥行。不要覆盖后续新增的其他授权密钥，也不需要回滚网站数据。

## 后续发布与回滚

继续通过宝塔管理站点配置，勿同时启用旧的独立 Nginx 配置。发布前备份数据库和文件，资源先上传，最后原子切换入口；勿把本地测试数据库上传到线上。不要直接运行旧 `rebuild.sh`，它会先删除整个 dist 目录，包括证书验证目录。

回滚前端时先解压备份到临时目录，再恢复旧入口与资源。回滚后端需先停 `lavamilk-pb` 并备份当时的新数据，再恢复旧钩子、迁移和数据库；整库恢复会丢弃本次上线后的数据，应按实际故障范围选择恢复方式。配置回滚通过宝塔配置编辑器恢复备份内容并检查语法，不要同时启用两份域名配置。

## 2026-09-24 GitHub 登录与独立 MySQL

社区 API 已从 PocketBase 迁到 Node 22 服务，代理至 127.0.0.1:8091；CMS 保持原服务。个人榜与历史报告保存于独立 MySQL 8.4，旧组织报告已迁入存档。部署位置、OAuth App 待配置步骤和回滚说明见 [GitHub 社区配置](github-community.md)。新的永久个人榜替代前文 v2 的近期账户榜，旧匿名扫描入口不再开放。
