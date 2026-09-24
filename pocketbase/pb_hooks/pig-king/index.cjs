// Public domain interface. No PocketBase, HTTP, filesystem or clock dependencies.
function normalizeRepository(input) {
  if (typeof input !== 'string' || input.length > 250) throw new Error('invalidRepo');
  const value = input.trim().replace(/^https:\/\/github\.com\//i, '').replace(/\/$/, '').replace(/\.git$/, '');
  if (!/^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,38})\/[a-zA-Z0-9_.-]{1,100}$/.test(value) || /\/(\.|\.\.)$/.test(value)) throw new Error('invalidRepo');
  return value.toLowerCase();
}

function scoreRepository(repository, commits) {
  const repo = normalizeRepository(repository);
  const seen = {};
  const sample = commits.filter((item) => {
    if (!item.sha || seen[item.sha]) return false;
    seen[item.sha] = true;
    return item.commit && item.commit.author && Number.isFinite(Date.parse(item.commit.author.date)) &&
      !(item.parents && item.parents.length > 1) &&
      !(item.author && (item.author.type === 'Bot' || /\[bot\]$/i.test(item.author.login || ''))) &&
      !/\[bot\]$/i.test(item.commit.author.name || '');
  });
  const definitions = [
    { id: 'night', weight: 30, matches: (c) => new Date(Date.parse(c.commit.author.date) + 8 * 3600000).getUTCHours() < 6 },
    { id: 'fix', weight: 30, matches: (c) => /\b(fix(?:es|ed)?|hotfix|oops|bugfix)\b|修复|修正|补丁/i.test(c.commit.message.split('\n')[0]) },
    { id: 'vague', weight: 25, matches: (c) => /^(?:update|fix|test|wip|tmp|stuff|changes?|misc|save|更新|修改|测试|修复|[.。]+)[.!。！\s]*$/i.test(c.commit.message.split('\n')[0].trim()) },
    { id: 'revert', weight: 15, matches: (c) => /^(?:revert\b|回滚|撤回)/i.test(c.commit.message.trim()) },
  ];
  const metrics = definitions.map((rule) => {
    const matches = sample.filter(rule.matches);
    return {
      id: rule.id, weight: rule.weight, count: matches.length,
      points: sample.length ? Math.round(matches.length / sample.length * rule.weight * 10) / 10 : 0,
      evidence: matches.slice(0, 2).map((c) => ({ sha: c.sha, message: c.commit.message.split('\n')[0].slice(0, 200) })),
    };
  });
  const score = Math.round(metrics.reduce((sum, m) => sum + m.points, 0));
  return {
    version: 1, repo, scanned: commits.length, eligible: sample.length, excluded: commits.length - sample.length,
    ranked: sample.length >= 20, score, tier: score >= 60 ? 'king' : score >= 35 ? 'chaos' : score >= 15 ? 'piglet' : 'angel',
    metrics,
  };
}

module.exports = { normalizeRepository, scoreRepository };
