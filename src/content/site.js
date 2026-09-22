// 本地默认内容（也是 CMS 的种子数据）。当 PocketBase 未启动时，站点用它照常渲染。
export default {
  site: {
    name: 'DevTools',
    heroTitle: 'Ship your code. We handle the rest.',
    heroSubtitle:
      'DevTools is the developer platform that builds, deploys, and scales your apps on a global edge network. Connect a repo and go live in under a minute.',
    footerBlurb: 'The developer platform to build, deploy, and scale your apps on the edge.',
  },
  features: [
    { t: 'Instant deploys', d: 'Push to your branch and ship to production in seconds. No pipelines to babysit.' },
    { t: 'Global edge network', d: 'Serve every request from the closest region, automatically, with zero config.' },
    { t: 'Preview environments', d: 'Every pull request gets its own live URL to review before you merge.' },
    { t: 'Built-in observability', d: 'Logs, traces, and metrics for every deploy, with no agents to install.' },
    { t: 'Instant rollbacks', d: 'Something broke? Roll back to any previous deploy in one click.' },
    { t: 'Secrets and env vars', d: 'Encrypted environment variables, scoped per environment and per branch.' },
  ],
  tiers: [
    { n: 'Hobby', p: '$0', d: 'For personal projects and experiments.', f: ['1 concurrent build', '100 GB bandwidth', 'Preview deployments', 'Community support'], cta: 'Start free', hi: false },
    { n: 'Pro', p: '$20', d: 'For professional developers and teams.', f: ['Everything in Hobby', 'Unlimited builds', '1 TB bandwidth', 'Observability + logs', 'Email support'], cta: 'Start free trial', hi: true },
    { n: 'Enterprise', p: 'Custom', d: 'For organizations at scale.', f: ['Everything in Pro', 'SSO and SAML', 'Audit logs and SLA', 'Dedicated support'], cta: 'Contact sales', hi: false },
  ],
  faqs: [
    { q: 'Is there a free plan?', a: 'Yes. The Hobby plan is free forever and includes preview deployments and 100 GB of bandwidth.' },
    { q: 'Can I change plans later?', a: 'Absolutely. Upgrade or downgrade at any time; changes are prorated automatically.' },
    { q: 'Do you offer discounts?', a: 'We offer discounts for startups and open-source projects. Reach out to our team.' },
  ],
  changelog: [
    { date: 'Jun 4, 2026', title: 'Edge Functions are now generally available', body: 'Run code at the edge in 18 regions with zero cold starts. Available on every plan today.' },
    { date: 'May 21, 2026', title: 'Faster builds with remote caching', body: 'Shared build caches cut median build times by 40% across the platform.' },
    { date: 'May 7, 2026', title: 'Audit logs for Enterprise', body: 'Every action in your workspace is now recorded and exportable for compliance.' },
    { date: 'Apr 23, 2026', title: 'One-click rollbacks', body: 'Promote any previous deploy back to production from the dashboard or the CLI.' },
  ],
}
