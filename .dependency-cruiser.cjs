module.exports = {
  forbidden: [
    { name: 'no-cycles', severity: 'error', from: {}, to: { circular: true } },
    { name: 'community-private', severity: 'error', from: { pathNot: '^server/community/(index\\.js|lib/)' }, to: { path: '^server/community/lib/' } },
    { name: 'no-production-test-imports', severity: 'error', from: { pathNot: '/tests/' }, to: { path: '/tests/' } },
    { name: 'no-browser-backend-imports', severity: 'error', from: { path: '^src/' }, to: { path: '^(server|pocketbase)/' } },
  ],
  options: { doNotFollow: { path: 'node_modules' }, exclude: { path: 'node_modules' } },
};
