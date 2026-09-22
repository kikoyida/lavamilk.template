# 官网（Vue 3 + PocketBase 动态官网）

基于开源模板 [saas-landing-page-template](https://github.com/hannah-wright/saas-landing-page-template)（MIT）改造的动态官网：

- **前台**：Vite + Vue 3 + Tailwind CSS v4（`DevTools.vue` 单文件组件，含 11 个页面）
- **后台可编辑**：PocketBase（自带管理后台，内容存 SQLite 数据库）
- **动效**：Hero 进场动画 + logo 跑马灯（模板自带），叠加滚动进场淡入（`src/plugins/reveal.js`）
- **内容策略**：前台优先读 PocketBase，连不上时自动回退本地默认内容（`src/content/site.js`），站点永不白屏

## 目录结构

```
src/
  components/DevTools.vue   页面组件（品牌名/Hero/价格/FAQ/更新日志等从 CMS 读取）
  composables/useSiteContent.js   CMS 拉取 + 本地兜底
  content/site.js            本地默认内容（也是 CMS 种子数据）
  plugins/reveal.js          滚动进场动效
  assets/globals.css         设计令牌 + 动效样式
scripts/pocketbase-setup.mjs  CMS 初始化脚本（建集合 + 灌种子数据）
pocketbase/                  PocketBase 可执行文件与数据
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

改完保存即生效（刷新前台页面即可看到）。若 PocketBase 未启动，前台会自动用 `src/content/site.js` 里的默认内容渲染。

## 首次下载 PocketBase 二进制

`pocketbase/pocketbase` 已加入 `.gitignore`。若换机器，需重新下载：

```bash
# macOS (Apple Silicon)，版本号以 GitHub Releases 为准
curl -4 -L -o /tmp/pb.zip "https://github.com/pocketbase/pocketbase/releases/download/v0.40.4/pocketbase_0.40.4_darwin_arm64.zip"
cd pocketbase && unzip -o /tmp/pb.zip && chmod +x pocketbase
```

## License

模板 MIT 许可（见 `LICENSE`）。
