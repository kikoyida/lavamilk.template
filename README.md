# 官网（Vue 3 + PocketBase 动态官网）

基于开源模板 [saas-landing-page-template](https://github.com/hannah-wright/saas-landing-page-template)（MIT）改造的动态官网：

- **前台**：Vite + Vue 3 + Tailwind CSS v4（`Lavamilk.vue` 单文件组件，含 11 个页面）
- **后台可编辑**：PocketBase（自带管理后台，内容存 SQLite 数据库）
- **多语言**：vue-i18n + JSON 语言包（`src/locales/`），顶栏可切换 English / 简体中文，选择记忆在 localStorage
- **动效**：Hero 进场动画 + logo 跑马灯（模板自带），叠加滚动进场淡入（`src/plugins/reveal.js`）
- **内容策略**：英文优先读 PocketBase（后台可编辑），其它语言读语言包；CMS 连不上时自动回退语言包，站点永不白屏

## 目录结构

```
src/
  components/Lavamilk.vue        页面组件（全部文案走 i18n）
  components/LanguageSwitcher.vue 语言切换器
  composables/useSiteContent.js  CMS 拉取 + 语言包兜底
  locales/en.json                英文语言包（content 字段同时是 CMS 种子数据）
  locales/zh-CN.json             简体中文语言包
  i18n.js                        vue-i18n 实例 + 语言记忆
  plugins/reveal.js              滚动进场动效
  assets/globals.css             设计令牌 + 动效样式
scripts/pocketbase-setup.mjs     CMS 初始化脚本（建集合 + 灌种子数据）
pocketbase/                      PocketBase 可执行文件与数据
```

## 启动

### 1. 安装依赖

```bash
npm install --cache /tmp/guanwang-npm-cache   # 若默认缓存有权限问题，指定缓存目录
```

### 2. 启动后台 CMS（PocketBase）

```bash
cd pocketbase
./pocketbase serve --http=127.0.0.1:8090
```

- 管理后台：http://127.0.0.1:8090/_/
- 账号：`admin@example.com` / `admin123456`

首次使用需初始化集合与数据：

```bash
npm run pb:setup
```

### 3. 启动前台

```bash
npm run dev        # http://localhost:5173
```

> Vite 已把 `/api` 代理到 PocketBase，前端无跨域问题。

## 后台怎么改内容

登录 http://127.0.0.1:8090/_/ 后，左侧可见这些集合：

| 集合 | 对应前台内容 |
|---|---|
| settings | 品牌名、Hero 标题/副标题、页脚介绍 |
| features | 首页/功能页的功能卡片 |
| tiers | 定价套餐 |
| faqs | 常见问题 |
| changelog | 更新日志 |

改完保存即生效（刷新前台页面即可看到）。若 PocketBase 未启动，前台会自动用语言包内容渲染。

## 多语言（English / 简体中文）

顶栏 `Sign in` 左侧有语言切换器，切换后写入 `localStorage`（key: `lavamilk-locale`），刷新保持。

新增语言只需两步：

1. 复制 `src/locales/en.json` 为 `src/locales/<code>.json` 并翻译；
2. 在 `src/i18n.js` 的 `messages` 与 `LOCALES` 里登记该语言。

语言包结构：

| 键 | 用途 |
|---|---|
| `nav` / `action` / `footer` | 导航、按钮、页脚等界面文案 |
| `home` / `page.*` | 各页面标题与正文 |
| `docsGroups` / `posts` / `roles` / `contacts` / `aboutStats` / `dash.*` | 列表数据 |
| `content.*` | 品牌信息与功能/套餐/FAQ/更新日志（= CMS 种子数据） |

> 目前 **CMS 只覆盖英文**：英文走后台可编辑，中文走语言包。如果中文也要后台可编辑，需要给 PocketBase 集合加 `_zh` 字段并在 `useSiteContent` 里按语言取字段。

## 首次下载 PocketBase 二进制

`pocketbase/pocketbase` 已加入 `.gitignore`。若换机器，需重新下载：

```bash
# macOS (Apple Silicon)，版本号以 GitHub Releases 为准
curl -4 -L -o /tmp/pb.zip "https://github.com/pocketbase/pocketbase/releases/download/v0.40.4/pocketbase_0.40.4_darwin_arm64.zip"
cd pocketbase && unzip -o /tmp/pb.zip && chmod +x pocketbase
```

## License

模板 MIT 许可（见 `LICENSE`）。
