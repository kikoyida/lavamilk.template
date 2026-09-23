// 把英文语言包 src/locales/en.json 的 content.site 同步到 PocketBase 的 settings 记录。
// 只更新品牌/Hero/页脚介绍这几个字段，不删除集合、不影响其它数据。
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const BASE = 'http://127.0.0.1:8090/api'
const EMAIL = process.env.PB_ADMIN_EMAIL || 'admin@example.com'
const PASSWORD = process.env.PB_ADMIN_PASSWORD || 'admin123456'

const __dirname = dirname(fileURLToPath(import.meta.url))
const site = JSON.parse(readFileSync(resolve(__dirname, '../src/locales/en.json'), 'utf8')).content.site

async function main() {
  const auth = await fetch(`${BASE}/collections/_superusers/auth-with-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identity: EMAIL, password: PASSWORD }),
  })
  if (!auth.ok) throw new Error(`登录失败: ${auth.status} ${await auth.text()}`)
  const token = (await auth.json()).token

  const listRes = await fetch(`${BASE}/collections/settings/records?perPage=1`)
  const list = await listRes.json()
  const rec = list?.items?.[0]
  if (!rec) throw new Error('settings 集合里没有记录，请先执行 npm run pb:setup')

  console.log('更新前 heroTitle:', rec.heroTitle)

  const res = await fetch(`${BASE}/collections/settings/records/${rec.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: token },
    body: JSON.stringify(site),
  })
  if (!res.ok) throw new Error(`更新失败: ${res.status} ${await res.text()}`)
  const updated = await res.json()

  console.log('更新后 heroTitle:', updated.heroTitle)
  console.log('更新后 heroSubtitle:', updated.heroSubtitle)
  console.log('\n✅ settings 已同步（其余集合数据未动）')
}

main().catch((e) => {
  console.error('❌', e.message)
  process.exit(1)
})
