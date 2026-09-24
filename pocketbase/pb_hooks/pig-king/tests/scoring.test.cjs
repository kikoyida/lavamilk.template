const { test } = require('node:test');
const assert = require('node:assert/strict');
const { normalizeRepository, scoreRepository } = require('../index.cjs');

function commit(sha, message = 'feat: add a useful feature', date = '2026-09-23T04:00:00Z', extra = {}) {
  return { sha, parents: [{}], author: { login: 'human', type: 'User' }, commit: { message, author: { name: 'Human', date } }, ...extra };
}

test('accepts repository identifiers and rejects foreign hosts or path injection', () => {
  assert.equal(normalizeRepository(' https://github.com/Example/Repo.git/ '), 'example/repo');
  for (const value of ['https://evil.test/a/b', 'a/b/commits', 'a/..', 'a/b?x=1', 'a/b#x', 'a/%2F', null, 'https://github.com@evil.test/a/b']) {
    assert.throws(() => normalizeRepository(value), /invalidRepo/);
  }
});

test('scores known evidence using fixed UTC+8 hours and per-metric weights', () => {
  const result = scoreRepository('a/b', [commit('1', 'fix', '2026-09-22T16:00:00Z'), commit('2', 'revert broken feature')]);
  assert.equal(result.score, 50);
  assert.deepEqual(result.metrics.map((m) => m.points), [15, 15, 12.5, 7.5]);
  assert.equal(result.metrics[0].evidence[0].sha, '1');
  assert.equal(result.ranked, false);
});

test('excludes merges, bots, duplicates and invalid dates from all denominators', () => {
  const result = scoreRepository('a/b', [commit('1', 'fix'), commit('1', 'fix'), commit('2', 'fix', undefined, { parents: [{}, {}] }), commit('3', 'fix', undefined, { author: { type: 'Bot' } }), commit('4', 'fix', 'invalid'), commit('5')]);
  assert.equal(result.eligible, 2);
  assert.equal(result.excluded, 4);
  assert.equal(result.score, 28);
});

test('ranks at 20 eligible commits, handles zero samples, and caps evidence', () => {
  assert.equal(scoreRepository('a/b', []).score, 0);
  assert.equal(scoreRepository('a/b', []).ranked, false);
  const commits = Array.from({ length: 20 }, (_, i) => commit(String(i), 'fix'));
  assert.equal(scoreRepository('a/b', commits.slice(1)).ranked, false);
  const result = scoreRepository('a/b', commits);
  assert.equal(result.ranked, true);
  assert.equal(result.metrics[1].evidence.length, 2);
  assert.equal(result.score, 55);
});

test('classifies Chinese messages and respects the end of the night window', () => {
  const result = scoreRepository('a/b', [commit('1', '修复', '2026-09-22T21:59:00Z'), commit('2', '撤回错误提交', '2026-09-22T22:00:00Z')]);
  assert.deepEqual(result.metrics.map((m) => m.count), [1, 1, 1, 1]);
});
