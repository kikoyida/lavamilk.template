import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

// Vite 会把 /api 代理到 PocketBase
const API = '/api/collections'

// 从 CMS 拉到的「英文」内容（后台可编辑的那部分）
const cms = ref(null)
let started = false

async function loadCms() {
  try {
    const [s, f, t, q, c] = await Promise.all([
      fetch(`${API}/settings/records?perPage=1`).then((r) => r.json()),
      fetch(`${API}/features/records?sort=sort&perPage=50`).then((r) => r.json()),
      fetch(`${API}/tiers/records?sort=sort&perPage=50`).then((r) => r.json()),
      fetch(`${API}/faqs/records?sort=sort&perPage=50`).then((r) => r.json()),
      fetch(`${API}/changelog/records?sort=-sort&perPage=50`).then((r) => r.json()),
    ])
    const next = {}
    if (s?.items?.length) next.settings = s.items[0]
    if (f?.items?.length) next.features = f.items.map((i) => ({ t: i.title, d: i.description }))
    if (t?.items?.length)
      next.tiers = t.items.map((i) => ({
        n: i.name,
        p: i.price,
        d: i.description,
        f: (i.features || '').split('\n').filter(Boolean),
        cta: i.cta,
        hi: !!i.highlight,
      }))
    if (q?.items?.length) next.faqs = q.items.map((i) => ({ q: i.question, a: i.answer }))
    if (c?.items?.length) next.changelog = c.items.map((i) => ({ date: i.date, title: i.title, body: i.body }))
    cms.value = next
  } catch (e) {
    // PocketBase 未启动 → 全部走语言包，站点照常渲染
    console.info('[content] 未连接 CMS，使用语言包内容')
  }
}

export function useSiteContent() {
  const { tm, locale } = useI18n()

  if (!started) {
    started = true
    loadCms()
  }

  const isDefault = computed(() => locale.value === 'en')
  const pack = computed(() => tm('content') || {})

  // 品牌信息：英文优先用 CMS，其它语言用语言包
  const site = computed(() => {
    const base = { ...(pack.value.site || {}) }
    const s = cms.value?.settings
    if (isDefault.value && s) {
      if (s.name) base.name = s.name
      if (s.heroTitle) base.heroTitle = s.heroTitle
      if (s.heroSubtitle) base.heroSubtitle = s.heroSubtitle
      if (s.footerBlurb) base.footerBlurb = s.footerBlurb
    }
    return base
  })

  // 列表内容：英文且 CMS 有数据时用 CMS，否则用当前语言包
  const list = (key) =>
    computed(() => {
      if (isDefault.value && cms.value?.[key]?.length) return cms.value[key]
      return pack.value[key] || []
    })

  return {
    site,
    features: list('features'),
    tiers: list('tiers'),
    faqs: list('faqs'),
    changelog: list('changelog'),
  }
}
