// 滚动进场动效插件：所有 <section> 进入视口时淡入 + 上移，
// 并提供一个 v-reveal 指令用于精细控制（可选 delay 做 stagger）。
export default {
  install(app) {
    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) return

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add('is-revealed')
            io.unobserve(e.target)
          }
        }
      },
      { threshold: 0.08, rootMargin: '0px 0px -40px 0px' }
    )

    const scan = (root) => {
      root.querySelectorAll('section').forEach((el) => {
        // 首页 hero 已有 df-rise 进场动画，跳过避免双重动画
        if (el.querySelector('.df-rise')) return
        if (!el.classList.contains('reveal')) {
          el.classList.add('reveal')
          io.observe(el)
        }
      })
    }

    app.directive('reveal', {
      mounted(el, binding) {
        el.classList.add('reveal')
        if (binding.value?.delay) el.style.transitionDelay = `${binding.value.delay}ms`
        io.observe(el)
      },
      unmounted(el) {
        io.unobserve(el)
      },
    })

    // 单页内切换页面（v-if）会重建 section，用 MutationObserver 自动补扫
    if (typeof MutationObserver !== 'undefined') {
      const mo = new MutationObserver(() => scan(document.body))
      mo.observe(document.body, { childList: true, subtree: true })
    }
    scan(document.body)
  },
}
