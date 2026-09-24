/// <reference path="../pb_data/types.d.ts" />
// PocketBase owns these route entry points; domain rules live behind index.cjs.
routerAdd('GET', '/api/pig-king/leaderboard', (e) => {
  const records = e.app.findRecordsByFilter('pig_scores', 'eligible >= 20 && version = 1', '-score,repo', 50, 0);
  return e.json(200, { items: records.map((r) => r.get('report')) });
});

routerAdd('POST', '/api/pig-king/scan', (e) => {
  const domain = require(__hooks + '/pig-king/index.cjs');
  let repo;
  try { repo = domain.normalizeRepository(e.requestInfo().body.repo); }
  catch (_) { return e.json(400, { code: 'invalidRepo' }); }

  const existing = e.app.findRecordsByFilter('pig_scores', 'repo = {:repo} && version = 1', '', 1, 0, { repo });
  if (existing.length && Date.now() - existing[0].getFloat('scannedAt') < 6 * 3600000) {
    return e.json(200, { report: existing[0].get('report'), cached: true });
  }

  // Token is optional and stays on the server; accept public repositories only.
  const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'Lavamilk-Pig-King' };
  const token = $os.getenv('PIG_GITHUB_TOKEN');
  if (token) headers.Authorization = 'Bearer ' + token;
  let metadata, commits;
  try {
    metadata = $http.send({ url: 'https://api.github.com/repos/' + repo, headers, timeout: 12 });
    if (metadata.statusCode === 404 || (metadata.statusCode === 200 && metadata.json.private)) return e.json(404, { code: 'notFound' });
    if (metadata.statusCode === 403 || metadata.statusCode === 429) return e.json(429, { code: 'rateLimit' });
    if (metadata.statusCode !== 200) return e.json(502, { code: 'github' });
    commits = $http.send({ url: 'https://api.github.com/repos/' + repo + '/commits?per_page=100', headers, timeout: 12 });
  } catch (_) { return e.json(502, { code: 'github' }); }
  if (commits.statusCode === 409) return e.json(422, { code: 'empty' });
  if (commits.statusCode === 403 || commits.statusCode === 429) return e.json(429, { code: 'rateLimit' });
  if (commits.statusCode !== 200) return e.json(502, { code: 'github' });
  const report = domain.scoreRepository(metadata.json.full_name, commits.json);
  report.scannedAt = new Date().toISOString();
  report.branch = metadata.json.default_branch;

  // Upsert inside a transaction: concurrent scans cannot create duplicate ranks.
  e.app.runInTransaction((app) => {
    const rows = app.findRecordsByFilter('pig_scores', 'repo = {:repo}', '', 1, 0, { repo: report.repo });
    const record = rows.length ? rows[0] : new Record(app.findCollectionByNameOrId('pig_scores'));
    record.set('repo', report.repo);
    record.set('score', report.score);
    record.set('eligible', report.eligible);
    record.set('version', report.version);
    record.set('scannedAt', Date.now());
    record.set('report', report);
    app.save(record);
  });
  return e.json(200, { report, cached: false });
}, $apis.bodyLimit(1024));
