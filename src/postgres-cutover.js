import { DatabaseSync } from 'node:sqlite';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { decrypt } from './model.js';

const tables = ['users','tenants','sessions','products','gateways','orders','images','audit','requests','resets'];
const trustTables = ['vendor_reports','vendor_report_events','vendor_report_evidence','vendor_restrictions','email_outbox','email_inbound','plaza_consultations','plaza_plans','plaza_rentals','plaza_billing_events','plaza_developers','plaza_vendor_access'];
const sourceHas = (source, table) => !!source.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(table);
const marker = 'sqlite_import_v1';
const keyPattern = /^[a-f0-9]{64}$/i;

export async function postgresKey(db, value) {
  const key = String(value || '').trim();
  if (!keyPattern.test(key)) throw new Error('Postgres requires a stable ENCRYPTION_KEY containing exactly 64 hexadecimal characters.');
  const encrypted = [
    ...(await db.all('SELECT config FROM gateways')).map(row => row.config),
    ...(await db.all("SELECT data::jsonb->>'paymentConfig' AS config FROM orders WHERE data::jsonb->>'paymentConfig' IS NOT NULL")).map(row => row.config)
  ];
  const samples = [await db.one('SELECT payload FROM vendor_reports LIMIT 1'),await db.one("SELECT payload FROM email_outbox WHERE payload<>'' LIMIT 1"),await db.one('SELECT payload FROM email_inbound LIMIT 1'),await db.one('SELECT payload FROM plaza_consultations LIMIT 1'),await db.one('SELECT purpose AS payload FROM plaza_vendor_access LIMIT 1')].filter(Boolean);
  try { for (const config of encrypted) decrypt(config, key); for(const sample of samples) decrypt(sample.payload,key); }
  catch { throw new Error('ENCRYPTION_KEY does not match the existing payment records. Restore the original key.'); }
  return key;
}

export async function assertPostgresCutover(db, dataDir) {
  const path = resolve(dataDir, 'plaza.sqlite');
  if (!existsSync(path)) return;
  const source = new DatabaseSync(path, { readOnly: true });
  try {
    const hasData = [...tables,...trustTables].some(table => sourceHas(source,table)&&source.prepare('SELECT 1 FROM ' + table + ' LIMIT 1').get());
    if (hasData && !await db.one('SELECT value FROM metadata WHERE key=?', marker)) {
      throw new Error('Existing SQLite records must be imported before enabling DATABASE_URL. See the Postgres cutover instructions.');
    }
  } finally { source.close(); }
}

export async function importSqlite(db, file, key) {
  if (!keyPattern.test(String(key || ''))) throw new Error('Set the original ENCRYPTION_KEY before importing.');
  const source = new DatabaseSync(file, { readOnly: true });
  try {
    source.exec('BEGIN');
    if (source.prepare('PRAGMA quick_check').get().quick_check !== 'ok' || source.prepare('PRAGMA foreign_key_check').get()) {
      throw new Error('SQLite backup integrity check failed.');
    }
    return await db.tx(async () => {
      if (await db.one('SELECT value FROM metadata WHERE key=?', marker)) throw new Error('This Postgres database already has a completed SQLite import.');
      for (const table of [...tables,...trustTables]) if (await db.one('SELECT 1 FROM ' + table + ' LIMIT 1')) throw new Error('Import requires an empty Postgres target.');
      const counts = {};
      for (const table of [...tables,...trustTables]) {
        if (!sourceHas(source,table)) continue;
        let count = 0;
        for (const row of source.prepare('SELECT * FROM ' + table).iterate()) {
          const values = Object.values(row).map(value => value instanceof Uint8Array ? Buffer.from(value) : value);
          await db.run('INSERT INTO ' + table + ' VALUES(' + values.map(() => '?').join(',') + ')', ...values);
          count++;
        }
        if ((await db.one('SELECT COUNT(*) AS n FROM ' + table)).n !== count) throw new Error('Import row-count mismatch: ' + table);
        counts[table] = count;
      }
      await postgresKey(db, key);
      await db.run('INSERT INTO metadata VALUES(?,?)', marker, new Date().toISOString());
      return counts;
    }, 'cutover');
  } finally { source.close(); }
}
