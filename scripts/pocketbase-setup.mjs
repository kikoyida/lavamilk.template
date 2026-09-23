// PocketBase 初始化：登录 → 建集合 → 灌入种子内容。可重复执行（幂等）。
// 种子数据取自英文语言包 src/locales/en.json 的 content 字段
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const defaults = JSON.parse(readFileSync(resolve(__dirname, '../src/locales/en.json'), 'utf8')).content

const BASE = 'http://127.0.0.1:8090/api'
const EMAIL = process.env.PB_ADMIN_EMAIL || 'admin@example.com'
const PASSWORD = process.env.PB_ADMIN_PASSWORD || 'admin123456'

async function api(path, token, method = 'GET', body) {
  const r = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: token } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!r.ok) throw new Error(`${method} ${path} 失败: ${r.status} ${await r.text()}`)
  if (r.status === 204) return null
  return r.json()
}

async function auth() {
  const r = await fetch(`${BASE}/collections/_superusers/auth-with-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identity: EMAIL, password: PASSWORD }),
  })
  if (!r.ok) throw new Error(`登录失败: ${r.status} ${await r.text()}`)
  return (await r.json()).token
}

const collections = [
  {
    name: 'settings', type: 'base',
    fields: [
      { name: 'name', type: 'text' },
      { name: 'heroTitle', type: 'text' },
      { name: 'heroSubtitle', type: 'text' },
      { name: 'footerBlurb', type: 'text' },
    ],
  },
  {
    name: 'features', type: 'base',
    fields: [
      { name: 'title', type: 'text', required: true },
      { name: 'description', type: 'text' },
      { name: 'sort', type: 'number' },
    ],
  },
  {
    name: 'tiers', type: 'base',
    fields: [
      { name: 'name', type: 'text', required: true },
      { name: 'price', type: 'text' },
      { name: 'description', type: 'text' },
      { name: 'features', type: 'text' },
      { name: 'cta', type: 'text' },
      { name: 'highlight', type: 'bool' },
      { name: 'sort', type: 'number' },
    ],
  },
  {
    name: 'faqs', type: 'base',
    fields: [
      { name: 'question', type: 'text', required: true },
      { name: 'answer', type: 'text' },
      { name: 'sort', type: 'number' },
    ],
  },
  {
    name: 'changelog', type: 'base',
    fields: [
      { name: 'date', type: 'text' },
      { name: 'title', type: 'text', required: true },
      { name: 'body', type: 'text' },
      { name: 'sort', type: 'number' },
    ],
  },
]

async function main() {
  const token = await auth()
  console.log('✔ 已登录 PocketBase')

  // 幂等：先删除同名旧集合
  const existing = await api('/collections?perPage=200', token)
  for (const name of collections.map((c) => c.name)) {
    const found = (existing.items || []).find((c) => c.name === name)
    if (found) {
      await api(`/collections/${found.id}`, token, 'DELETE')
      console.log(`  - 删除旧集合 ${name}`)
    }
  }

  for (const c of collections) {
    await api('/collections', token, 'POST', {
      name: c.name,
      type: c.type,
      fields: c.fields,
      listRule: '',
      viewRule: '',
      createRule: null,
      updateRule: null,
      deleteRule: null,
    })
    console.log(`✔ 集合 ${c.name} 已创建`)
  }

  const seeds = {
    settings: [defaults.site],
    features: defaults.features.map((f, i) => ({ title: f.t, description: f.d, sort: i })),
    tiers: defaults.tiers.map((t, i) => ({
      name: t.n, price: t.p, description: t.d, features: t.f.join('\n'), cta: t.cta, highlight: t.hi, sort: i,
    })),
    faqs: defaults.faqs.map((q, i) => ({ question: q.q, answer: q.a, sort: i })),
    changelog: defaults.changelog.map((c, i) => ({ date: c.date, title: c.title, body: c.body, sort: i })),
  }

  for (const [name, rows] of Object.entries(seeds)) {
    for (const row of rows) await api(`/collections/${name}/records`, token, 'POST', row)
    console.log(`✔ 集合 ${name} 已写入 ${rows.length} 条数据`)
  }

  console.log('\n✅ 全部完成')
  console.log('   后台管理: http://127.0.0.1:8090/_/  (admin@example.com / admin123456)')
  console.log('   REST API: http://127.0.0.1:8090/api/collections/...')
}

main().catch((e) => {
  console.error('❌ 失败:', e.message)
  process.exit(1)
})
