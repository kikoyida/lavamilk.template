// Public account-scan interface. Transport, storage and clock belong to callers.
const { scoreRepository } = require('../pig-king/index.cjs');
const { summarize } = require('./lib/summary.cjs');

function normalizeAccount(input) {
  if (typeof input !== 'string' || input.length > 120) throw new Error('invalidAccount');
  const value = input.trim().replace(/^https:\/\/github\.com\//i, '').replace(/\/$/, '').replace(/^@/, '');
  if (!/^[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?$/i.test(value) || value.includes('--')) throw new Error('invalidAccount');
  return value.toLowerCase();
}
function begin(account, now) {
  return { version: 2, account: normalizeAccount(account), phase: 'profile', page: 1, repositories: [],
    startedAt: new Date(now).toISOString(), since: new Date(now - 90 * 86400000).toISOString().slice(0, 10) };
}
function compactRepo(r) {
  return { name: r.full_name, description: (r.description || '').slice(0, 240), language: r.language || '',
    stars: r.stargazers_count || 0, fork: !!r.fork, archived: !!r.archived, pushedAt: r.pushed_at };
}
function compactActivity(item) {
  return { title: (item.title || '').slice(0, 200), url: item.html_url, state: item.state,
    comments: item.comments || 0, createdAt: item.created_at, merged: !!item.pull_request?.merged_at };
}
function next(state, { github, ai, now }) {
  // Each call performs at most one upstream request, allowing resumable progress.
  const s = JSON.parse(JSON.stringify(state));
  if (s.phase === 'profile') {
    const profile = github('/users/' + s.account);
    if (!['User', 'Organization'].includes(profile.type)) throw new Error('unsupportedAccount');
    if (normalizeAccount(profile.login) !== s.account) throw new Error('notFound');
    s.kind = profile.type;
    s.expectedRepos = profile.public_repos;
    s.phase = 'repos';
  } else if (s.phase === 'repos') {
    if (s.page > 100) throw new Error('tooLarge'); // Fail explicitly; never claim truncated repositories are complete.
    const path = s.kind === 'Organization' ? '/orgs/' : '/users/';
    const rows = github(path + s.account + '/repos?type=' + (s.kind === 'Organization' ? 'public' : 'owner') + '&sort=full_name&direction=asc&per_page=100&page=' + s.page);
    if (!Array.isArray(rows)) throw new Error('github');
    const seen = new Set(s.repositories.map(r => r.name.toLowerCase()));
    rows.filter(r => !r.private && r.owner?.login?.toLowerCase() === s.account).forEach(r => {
      if (!seen.has(r.full_name.toLowerCase())) { s.repositories.push(compactRepo(r)); seen.add(r.full_name.toLowerCase()); }
    });
    s.page++;
    if (rows.length < 100) { s.phase = 'commits'; s.repositoriesComplete = true; }
  } else if (['commits', 'prs', 'issues'].includes(s.phase)) {
    const field = s.phase;
    const qualifier = s.kind === 'Organization' ? 'org:' : 'author:';
    const range = s.since + '..' + s.startedAt.slice(0, 10);
    const query = qualifier + s.account + ' is:public ' + (field === 'commits'
      ? 'author-date:' + range + ' merge:false'
      : 'is:' + (field === 'prs' ? 'pr' : 'issue') + ' created:' + range);
    const result = github('/search/' + (field === 'commits' ? 'commits' : 'issues') + '?q=' + encodeURIComponent(query)
      + '&sort=' + (field === 'commits' ? 'author-date' : 'created') + '&order=desc&per_page=100');
    if (!Array.isArray(result.items) || typeof result.total_count !== 'number') throw new Error('github');
    const items = field === 'commits' ? result.items.filter(c => !c.repository?.private).map(c => ({
      sha: c.sha, parents: c.parents, author: c.author ? { login: c.author.login, type: c.author.type } : null,
      commit: { message: (c.commit?.message || '').slice(0, 500), author: { date: c.commit?.author?.date, name: c.commit?.author?.name } },
      repo: c.repository?.full_name, url: c.html_url,
    })) : result.items.map(compactActivity);
    s[field] = { total: result.total_count, sampled: items.length, incomplete: !!result.incomplete_results, items };
    s.phase = field === 'commits' ? 'prs' : field === 'prs' ? 'issues' : 'ai';
  } else if (s.phase === 'ai') {
    s.report = buildReport(s, now);
    s.report.ai = summarize(s.report, ai);
    s.phase = 'done';
    // The public report contains everything retained after completion.
    delete s.commits; delete s.prs; delete s.issues; delete s.repositories;
  }
  return s;
}
function buildReport(s, now) {
  const score = scoreRepository(s.account + '/account', s.commits.items);
  delete score.repo;
  for (const metric of score.metrics) {
    metric.evidence = metric.evidence.map(e => {
      const c = s.commits.items.find(c => c.sha === e.sha);
      return { ...e, url: c.url, repo: c.repo };
    });
  }
  const languages = {};
  s.repositories.filter(r => !r.fork && r.language).forEach(r => { languages[r.language] = (languages[r.language] || 0) + 1; });
  return { ...score, version: 2, account: s.account, kind: s.kind, since: s.since, until: s.startedAt.slice(0, 10),
    scannedAt: new Date(now).toISOString(), repositories: s.repositories,
    repositoryStats: { total: s.repositories.length, original: s.repositories.filter(r => !r.fork).length,
      archived: s.repositories.filter(r => r.archived).length, stars: s.repositories.reduce((n, r) => n + r.stars, 0), languages },
    coverage: { repositoriesComplete: !!s.repositoriesComplete,
      commits: { total: s.commits.total, sampled: s.commits.sampled, incomplete: s.commits.incomplete },
      prs: { total: s.prs.total, sampled: s.prs.sampled, incomplete: s.prs.incomplete },
      issues: { total: s.issues.total, sampled: s.issues.sampled, incomplete: s.issues.incomplete } },
    prs: s.prs.items, issues: s.issues.items };
}
module.exports = { normalizeAccount, begin, next };
