const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const vm = require('node:vm');

// Exercise registered HTTP handlers through their public routes. Runtime/HTTP
// adapters are replaced; production scoring is used unchanged.
function server(responses) {
  const routes = {};
  const rows = [];
  let requests = 0;
  class Record {
    values = {};
    set(key, value) { this.values[key] = value; }
    get(key) { return this.values[key]; }
    getFloat(key) { return this.values[key]; }
  }
  const app = {
    findRecordsByFilter(collection, filter, sort, limit, offset, params) {
      return rows.filter((r) => params ? r.get('repo') === params.repo : r.get('eligible') >= 20).slice(0, limit);
    },
    findCollectionByNameOrId() { return {}; },
    runInTransaction(callback) { callback(app); },
    save(record) { if (!rows.includes(record)) rows.push(record); },
  };
  const context = {
    require, __hooks: resolve(__dirname, '../..'), Record,
    routerAdd(method, path, handler) { routes[`${method} ${path}`] = handler; },
    $apis: { bodyLimit() {} }, $os: { getenv() { return ''; } },
    $http: { send() { requests++; const value = responses.shift(); if (value instanceof Error) throw value; return value; } },
  };
  vm.runInNewContext(readFileSync(resolve(__dirname, '../../pig-king.pb.js'), 'utf8'), context);
  return {
    call(method, path, body = {}) {
      return routes[`${method} /api/pig-king/${path}`]({ app, requestInfo: () => ({ body }), json: (status, data) => ({ status, data }) });
    },
    requests: () => requests,
  };
}

const metadata = { statusCode: 200, json: { full_name: 'demo/project', private: false, default_branch: 'main' } };
const commits = { statusCode: 200, json: Array.from({ length: 20 }, (_, i) => ({ sha: String(i), parents: [{}], commit: { message: 'fix', author: { name: 'Human', date: '2026-09-23T04:00:00Z' } } })) };

test('scan computes server-owned score, persists and reuses a cached report', () => {
  const api = server([metadata, commits]);
  const first = api.call('POST', 'scan', { repo: 'demo/project', score: 100 });
  assert.equal(first.status, 200);
  assert.equal(first.data.report.score, 55);
  assert.equal(first.data.cached, false);
  assert.equal(api.call('POST', 'scan', { repo: 'DEMO/project' }).data.cached, true);
  assert.equal(api.requests(), 2);
  assert.equal(api.call('GET', 'leaderboard').data.items.length, 1);
});

test('invalid input never makes an upstream request', () => {
  const api = server([]);
  assert.equal(api.call('POST', 'scan', { repo: 'https://evil.test/a/b' }).status, 400);
  assert.equal(api.requests(), 0);
});

test('private, missing, empty and rate-limited repositories never enter rankings', () => {
  for (const [responses, status, code] of [
    [[{ statusCode: 200, json: { private: true } }], 404, 'notFound'],
    [[{ statusCode: 404 }], 404, 'notFound'],
    [[metadata, { statusCode: 409 }], 422, 'empty'],
    [[{ statusCode: 403 }], 429, 'rateLimit'],
    [[metadata, { statusCode: 429 }], 429, 'rateLimit'],
    [[new Error('timeout')], 502, 'github'],
  ]) {
    const api = server(responses);
    const result = api.call('POST', 'scan', { repo: 'demo/project' });
    assert.equal(result.status, status);
    assert.equal(result.data.code, code);
    assert.equal(api.call('GET', 'leaderboard').data.items.length, 0);
  }
});

test('a short sample produces a report without joining the leaderboard', () => {
  const api = server([metadata, { statusCode: 200, json: commits.json.slice(0, 2) }]);
  assert.equal(api.call('POST', 'scan', { repo: 'demo/project' }).data.report.ranked, false);
  assert.equal(api.call('GET', 'leaderboard').data.items.length, 0);
});
