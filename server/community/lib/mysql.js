import mysql from 'mysql2/promise';
import { randomUUID } from 'node:crypto';

export async function openStore(url) {
  const pool = mysql.createPool({ uri: url, connectionLimit: 5, timezone: 'Z', supportBigNumbers: true, bigNumberStrings: true });
  await pool.query(`CREATE TABLE IF NOT EXISTS community_users (
    github_id VARCHAR(24) PRIMARY KEY, login VARCHAR(39) NOT NULL UNIQUE,
    avatar_url VARCHAR(255) NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP)`);
  await pool.query(`CREATE TABLE IF NOT EXISTS community_sessions (
    token_hash CHAR(64) PRIMARY KEY, github_id VARCHAR(24) NOT NULL, expires_at BIGINT NOT NULL,
    INDEX (expires_at), FOREIGN KEY (github_id) REFERENCES community_users(github_id))`);
  await pool.query(`CREATE TABLE IF NOT EXISTS community_oauth (
    state_hash CHAR(64) PRIMARY KEY, verifier VARCHAR(128) NOT NULL, expires_at BIGINT NOT NULL)`);
  await pool.query(`CREATE TABLE IF NOT EXISTS community_reports (
    github_id VARCHAR(24) PRIMARY KEY, account VARCHAR(39) NOT NULL, score INT NOT NULL,
    eligible INT NOT NULL, completed_at BIGINT NOT NULL, report JSON NOT NULL,
    INDEX ranking (score DESC, account), FOREIGN KEY (github_id) REFERENCES community_users(github_id))`);
  await pool.query(`CREATE TABLE IF NOT EXISTS community_report_history (
    id CHAR(36) PRIMARY KEY, github_id VARCHAR(24) NOT NULL, completed_at BIGINT NOT NULL,
    report JSON NOT NULL, INDEX (github_id, completed_at))`);
  await pool.query(`CREATE TABLE IF NOT EXISTS community_jobs (
    github_id VARCHAR(24) PRIMARY KEY, state JSON, lease CHAR(36), locked_until BIGINT NOT NULL DEFAULT 0,
    last_request BIGINT NOT NULL DEFAULT 0, failure VARCHAR(40) NOT NULL DEFAULT '')`);
  await pool.query(`CREATE TABLE IF NOT EXISTS community_legacy_reports (
    account VARCHAR(39) PRIMARY KEY, imported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, report JSON NOT NULL)`);
  const decode = x => typeof x === 'string' ? JSON.parse(x) : x;
  async function transaction(fn) {
    const conn = await pool.getConnection();
    try { await conn.beginTransaction(); const result = await fn(conn); await conn.commit(); return result; }
    catch (e) { await conn.rollback(); throw e; } finally { conn.release(); }
  }
  return {
    async health() { await pool.query('SELECT 1'); },
    close: () => pool.end(),
    async saveOAuth(hash, verifier, expires) {
      await pool.execute('DELETE FROM community_oauth WHERE expires_at < ?', [Date.now()]);
      await pool.execute('DELETE FROM community_sessions WHERE expires_at < ?', [Date.now()]);
      await pool.execute('INSERT INTO community_oauth VALUES (?,?,?)', [hash, verifier, expires]);
    },
    takeOAuth(hash, now) { return transaction(async conn => {
      const [rows] = await conn.execute('SELECT verifier, expires_at FROM community_oauth WHERE state_hash=? FOR UPDATE', [hash]);
      await conn.execute('DELETE FROM community_oauth WHERE state_hash=?', [hash]);
      return rows[0] && Number(rows[0].expires_at) > now ? rows[0].verifier : null;
    }); },
    async signIn(user, tokenHash, expires) {
      return transaction(async conn => {
        // GitHub numeric ID is the identity; usernames can change or be recycled.
        await conn.execute('UPDATE community_users SET login=CONCAT("~retired-",github_id) WHERE login=? AND github_id<>?', [user.login, user.id]);
        await conn.execute(`INSERT INTO community_users (github_id,login,avatar_url) VALUES (?,?,?)
          ON DUPLICATE KEY UPDATE login=VALUES(login),avatar_url=VALUES(avatar_url)`, [user.id, user.login, user.avatar]);
        await conn.execute('INSERT INTO community_sessions VALUES (?,?,?)', [tokenHash, user.id, expires]);
      });
    },
    async session(hash, now) {
      const [rows] = await pool.execute(`SELECT u.github_id id,u.login,u.avatar_url avatar FROM community_sessions s
        JOIN community_users u USING(github_id) WHERE s.token_hash=? AND s.expires_at>?`, [hash, now]);
      return rows[0] || null;
    },
    async logout(hash) { await pool.execute('DELETE FROM community_sessions WHERE token_hash=?', [hash]); },
    async leaderboard() {
      const [rows] = await pool.query(`SELECT u.login account,u.avatar_url avatar,r.score,r.eligible,r.report,r.completed_at
        FROM community_reports r JOIN community_users u USING(github_id)
        WHERE r.eligible>=20 AND u.login NOT LIKE '~retired-%' ORDER BY r.score DESC,u.login ASC LIMIT 50`);
      return rows.map(r => ({ account: r.account, avatar: r.avatar, score: r.score, eligible: r.eligible,
        tier: decode(r.report).tier, scannedAt: new Date(Number(r.completed_at)).toISOString() }));
    },
    async report(login) {
      const [rows] = await pool.execute(`SELECT r.report,u.login FROM community_reports r
        JOIN community_users u USING(github_id) WHERE u.login=?`, [login]);
      return rows[0] ? { ...decode(rows[0].report), account: rows[0].login } : null;
    },
    claim(user, now, begin) { return transaction(async conn => {
      await conn.execute('INSERT IGNORE INTO community_jobs (github_id) VALUES (?)', [user.id]);
      const [[job]] = await conn.execute('SELECT * FROM community_jobs WHERE github_id=? FOR UPDATE', [user.id]);
      const [[saved]] = await conn.execute('SELECT * FROM community_reports WHERE github_id=?', [user.id]);
      if (saved && Number(saved.completed_at) > now - 6*3600000 && saved.account === user.login)
        return { response: { status: 'done', cached: true, report: decode(saved.report) } };
      let state = decode(job.state);
      if (Number(job.locked_until) > now) {
        if (job.failure) throw new Error(job.failure);
        return { response: { status: 'pending', phase: state?.phase || 'profile', repositories: state?.repositories?.length || 0 } };
      }
      if (now - Number(job.last_request) < 2000) throw new Error('rateLimit');
      if (!state || state.account !== user.login || Date.parse(state.startedAt) < now - 6*3600000) state = begin(user.login, now);
      const lease = randomUUID();
      await conn.execute('UPDATE community_jobs SET state=?,lease=?,locked_until=?,last_request=?,failure=? WHERE github_id=?',
        [JSON.stringify(state), lease, now+120000, now, '', user.id]);
      return { state, lease };
    }); },
    finish(user, lease, state, failure, now) { return transaction(async conn => {
      const [[job]] = await conn.execute('SELECT lease FROM community_jobs WHERE github_id=? FOR UPDATE', [user.id]);
      if (job?.lease !== lease) throw new Error('rateLimit');
      if (state?.phase === 'done') {
        const report = state.report;
        if (report.kind !== 'User') throw new Error('unsupportedAccount');
        const serialized = JSON.stringify(report);
        await conn.execute(`INSERT INTO community_reports VALUES (?,?,?,?,?,?) ON DUPLICATE KEY UPDATE
          account=VALUES(account),score=VALUES(score),eligible=VALUES(eligible),completed_at=VALUES(completed_at),report=VALUES(report)`,
          [user.id, report.account, report.score, report.ranked ? report.eligible : 0, now, serialized]);
        await conn.execute('INSERT INTO community_report_history VALUES (?,?,?,?)', [randomUUID(), user.id, now, serialized]);
        await conn.execute('UPDATE community_jobs SET state=NULL,lease=NULL,locked_until=0,failure=? WHERE github_id=?', ['',user.id]);
        return { status: 'done', cached: false, report };
      }
      if (state) await conn.execute('UPDATE community_jobs SET state=? WHERE github_id=?', [JSON.stringify(state),user.id]);
      await conn.execute('UPDATE community_jobs SET lease=NULL,locked_until=?,failure=? WHERE github_id=?', [failure ? now+60000 : 0, failure || '', user.id]);
      return { status: 'pending', phase: state?.phase, repositories: state?.repositories?.length || 0 };
    }); },
    async importLegacy(reports) {
      for (const report of reports) await pool.execute('INSERT IGNORE INTO community_legacy_reports (account,report) VALUES (?,?)', [report.account, JSON.stringify(report)]);
    },
  };
}
