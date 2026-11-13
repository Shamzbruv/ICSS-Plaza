import { AsyncLocalStorage } from 'node:async_hooks';
import { DatabaseSync } from 'node:sqlite';
import { resolve } from 'node:path';
import pg from 'pg';
import { sqliteSchema } from './sqlite-schema.js';

export function openSqlite(dataDir) {
  const db = new DatabaseSync(resolve(dataDir, 'plaza.sqlite'));
  db.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
  db.exec(sqliteSchema);
  const scope = new AsyncLocalStorage();
  let queue = Promise.resolve();
  const exclusive = task => {
    const result = queue.then(task);
    queue = result.catch(() => {});
    return result;
  };
  const call = task => scope.getStore() ? task() : exclusive(task);
  return {
    kind: 'sqlite', raw: db,
    one: (sql, ...args) => call(() => db.prepare(sql).get(...args)),
    all: (sql, ...args) => call(() => db.prepare(sql).all(...args)),
    run: (sql, ...args) => call(() => db.prepare(sql).run(...args)),
    close: () => exclusive(() => db.close()),
    tx: fn => exclusive(async () => {
      db.exec('BEGIN IMMEDIATE');
      try {
        const result = await scope.run(true, fn);
        db.exec('COMMIT');
        return result;
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    })
  };
}

const pgTypes = {
  getTypeParser(oid, format) {
    if (oid === 20 && format !== 'binary') return value => {
      const number = Number(value);
      if (!Number.isSafeInteger(number)) throw new Error('Database integer exceeds the supported range.');
      return number;
    };
    return pg.types.getTypeParser(oid, format);
  }
};

export function createPostgresPool(connectionString, production) {
  let url;
  try { url = new URL(connectionString); }
  catch { throw new Error('DATABASE_URL must be a Postgres connection URL.'); }
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) throw new Error('DATABASE_URL must be a Postgres connection URL.');
  // Discard URL TLS overrides; production always verifies the server certificate.
  for (const key of ['ssl', 'sslmode', 'sslcert', 'sslkey', 'sslrootcert', 'uselibpqcompat']) url.searchParams.delete(key);
  const pool = new pg.Pool({
    connectionString: url.toString(),
    ssl: production ? { rejectUnauthorized: true } : undefined,
    types: pgTypes, max: 5, connectionTimeoutMillis: 8000, idleTimeoutMillis: 10000,
    statement_timeout: 20000,
    application_name: 'icss-plaza',
    onConnect: client => client.query('SET search_path TO icss_plaza, pg_catalog')
  });
  pool.on('error', error => console.error('Database connection interrupted:', error.code || error.name));
  return pool;
}

export function openPostgres(pool) {
  const scope = new AsyncLocalStorage();
  const query = (sql, args) => {
    let i = 0;
    // Placeholders occur only in app-owned statements. User values are passed separately.
    const statement = sql.replaceAll('?', () => '$' + (++i));
    return (scope.getStore() || pool).query(statement, args);
  };
  return {
    kind: 'postgres',
    one: async (sql, ...args) => (await query(sql, args)).rows[0],
    all: async (sql, ...args) => (await query(sql, args)).rows,
    run: (sql, ...args) => query(sql, args),
    close: () => pool.end(),
    async tx(fn, lock) {
      const client = await pool.connect();
      let discard;
      try {
        await client.query('BEGIN');
        if (lock) await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', ['icss-plaza:' + lock]);
        const result = await scope.run(client, fn);
        await client.query('COMMIT');
        return result;
      } catch (error) {
        try { await client.query('ROLLBACK'); } catch (rollbackError) { discard = rollbackError; }
        throw error;
      } finally {
        client.release(discard);
      }
    }
  };
}

export const revenueSQL = db => db.kind === 'postgres'
  ? "SELECT COALESCE(SUM((data::jsonb->>'total')::bigint),0)::bigint AS n FROM orders WHERE tenant_id=? AND paid=1"
  : "SELECT COALESCE(SUM(json_extract(data,'$.total')),0) AS n FROM orders WHERE tenant_id=? AND paid=1";
