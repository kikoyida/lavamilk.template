// Browser API boundary. Scores and persistence are exclusively server-owned.
async function request(path, options = {}) {
  let response;
  try {
    response = await fetch(`/api/pig-king/${path}`, { ...options, signal: options.signal || AbortSignal.timeout(105000) });
  } catch (_) { throw new Error('offline'); }
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.code || (response.status === 429 ? 'rateLimit' : 'offline'));
  if (!data) throw new Error('offline');
  return data;
}

export function scanRepository(repo) {
  return request('scan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ repo }) });
}

export async function getLeaderboard() {
  const data = await request('leaderboard');
  if (!Array.isArray(data.items)) throw new Error('offline');
  return data.items;
}

// Account scans advance one server-owned stage per request. A retry resumes it.
export async function scanAccount(onProgress, signal) {
  for (;;) {
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
    const data = await request('account-scan', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}), signal: AbortSignal.any([signal, AbortSignal.timeout(105000)]) });
    if (data.status === 'done') return data;
    if (data.status !== 'pending') throw new Error('offline');
    onProgress(data);
    await new Promise((resolve, reject) => {
      const abort = () => { clearTimeout(timer); reject(new DOMException('Aborted', 'AbortError')); };
      const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve(); }, 2200);
      signal.addEventListener('abort', abort, { once: true });
      if (signal.aborted) abort();
    });
  }
}
export async function getAccountLeaderboard() {
  const data = await request('account-leaderboard');
  if (!Array.isArray(data.items)) throw new Error('offline');
  return data.items;
}
export function getAccountReport(account) {
  return request('account-report/' + encodeURIComponent(account));
}

export function getSession() { return request('auth/session'); }
export function loginGitHub() { window.location.assign('/api/pig-king/auth/login'); }
export function logoutGitHub() { return request('auth/logout', { method: 'POST' }); }
