import { ref } from 'vue'
import defaults from '../content/site'

// Vite 会把 /api 代理到 PocketBase；连不上时回退到本地默认内容
const API = '/api/collections'

const site = ref({ ...defaults.site })
const features = ref([...defaults.features])
const tiers = ref([...defaults.tiers])
const faqs = ref([...defaults.faqs])
const changelog = ref([...defaults.changelog])

let loaded = false

async function load() {
  if (loaded) return
  loaded = true
  try {
    const [s, f, t, q, c] = await Promise.all([
      fetch(`${API}/settings/records?perPage=1`).then((r) => r.json()),
      fetch(`${API}/features/records?sort=sort&perPage=50`).then((r) => r.json()),
      fetch(`${API}/tiers/records?sort=sort&perPage=50`).then((r) => r.json()),
      fetch(`${API}/faqs/records?sort=sort&perPage=50`).then((r) => r.json()),
      fetch(`${API}/changelog/records?sort=-sort&perPage=50`).then((r) => r.json()),
    ])

    if (s?.items?.length) site.value = { ...defaults.site, ...s.items[0] }
    if (f?.items?.length) features.value = f.items.map((i) => ({ t: i.title, d: i.description }))
    if (t?.items?.length)
      tiers.value = t.items.map((i) => ({
        n: i.name,
        p: i.price,
        d: i.description,
        f: (i.features || '').split('\n').filter(Boolean),
        cta: i.cta,
        hi: !!i.highlight,
      }))
    if (q?.items?.length) faqs.value = q.items.map((i) => ({ q: i.question, a: i.answer }))
    if (c?.items?.length) changelog.value = c.items.map((i) => ({ date: i.date, title: i.title, body: i.body }))
  } catch (e) {
    // PocketBase 未启动/未配置 → 用本地默认内容，站点照常渲染
    console.info('[content] 未连接 CMS，使用本地默认内容')
  }
}

load()

export function useSiteContent() {
  return { site, features, tiers, faqs, changelog }
}
