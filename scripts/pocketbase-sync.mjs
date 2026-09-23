// 把英文语言包 src/locales/en.json 的 content 同步进 PocketBase。
// 不删除集合、不改 schema；settings 就地更新，列表集合按 sort 顺序多退少补。
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const BASE = 'http://127.0.0.1:8090/api'
const EMAIL = process.env.PB_ADMIN_EMAIL || 'admin@example.com'
const PASSWORD = process.env.PB_ADMIN_PASSWORD || 'admin123456'

const __dirname = dirname(fileURLToPath(import.meta.url))
const content = JSON.parse(readFileSync(resolve(__dirname, '../src/locales/en.json'), 'utf8')).content

// 语言包的字段名 → CMS 集合字段名
const LIST_MAP = {
  features: (f, i) => ({ title: f.t, description: f.d, sort: i }),
  tiers: (t, i) => ({
    name: t.n, price: t.p, description: t.d, features: t.f.join('\n'), cta: t.cta, highlight: t.hi, sort: i,
  }),
  faqs: (q, i) => ({ question: q.q, answer: q.a, sort: i }),
  changelog: (c, i) => ({ date: c.date, title: c.title, body: c.body, sort: i }),
}

async function main() {
  const authRes = await fetch(`${BASE}/collections/_superusers/auth-with-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identity: EMAIL, password: PASSWORD }),
  })
  if (!authRes.ok) throw new Error(`登录失败: ${authRes.status} ${await authRes.text()}`)
  const token = (await authRes.json()).token
  const H = { 'Content-Type': 'application/json', Authorization: token }

  // 1) settings（单条记录）
  const listRes = await fetch(`${BASE}/collections/settings/records?perPage=1`)
  const settingsItem = (await listRes.json())?.items?.[0]
  const settingsUrl = settingsItem
    ? `${BASE}/collections/settings/records/${settingsItem.id}`
    : `${BASE}/collections/settings/records`
  const sRes = await fetch(settingsUrl, {
    method: settingsItem ? 'PATCH' : 'POST',
    headers: H,
    body: JSON.stringify(content.site),
  })
  if (!sRes.ok) throw new Error(`settings 同步失败: ${sRes.status} ${await sRes.text()}`)
  console.log(`✔ settings ${settingsItem ? '已更新' : '已创建'}`)

  // 2) 列表集合
  for (const [name, map] of Object.entries(LIST_MAP)) {
    const rows = (content[name] || []).map(map)
    const cur = await fetch(`${BASE}/collections/${name}/records?sort=sort&perPage=200`)
    const existing = (await cur.json())?.items || []
    let updated = 0, created = 0, removed = 0

    for (let i = 0; i < rows.length; i++) {
      const url = existing[i]
        ? `${BASE}/collections/${name}/records/${existing[i].id}`
        : `${BASE}/collections/${name}/records`
      const r = await fetch(url, {
        method: existing[i] ? 'PATCH' : 'POST',
        headers: H,
        body: JSON.stringify(rows[i]),
      })
      if (!r.ok) throw new Error(`${name}[${i}] 同步失败: ${r.status} ${await r.text()}`)
      existing[i] ? updated++ : created++
    }
    for (let i = rows.length; i < existing.length; i++) {
      const r = await fetch(`${BASE}/collections/${name}/records/${existing[i].id}`, { method: 'DELETE', headers: H })
      if (!r.ok && r.status !== 204) throw new Error(`${name}[${i}] 删除失败: ${r.status}`)
      removed++
    }
    console.log(`✔ ${name}: 更新 ${updated} / 新增 ${created} / 删除 ${removed}`)
  }

  console.log('\n✅ 同步完成（集合结构未动）')
}

main().catch((e) => {
  console.error('❌', e.message)
  process.exit(1)
})
