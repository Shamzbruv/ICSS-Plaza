import { randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync, linkSync, unlinkSync, chmodSync } from 'node:fs';
import { resolve } from 'node:path';
import { decrypt } from './model.js';

const validKey = value => /^[a-f0-9]{64}$/i.test(value);

export function resolveBaseURL({ baseURL, production, env = process.env }) {
  const explicit = baseURL ?? env.BASE_URL;
  const domain = String(env.RAILWAY_PUBLIC_DOMAIN || '').trim();
  const value = String(explicit || (domain ? `https://${domain}` : production ? '' : 'http://localhost:3000')).trim();
  if (!value) throw new Error('Set BASE_URL to your HTTPS public origin or configure a public domain so RAILWAY_PUBLIC_DOMAIN is available.');
  let parsed;
  try { parsed = new URL(value); } catch { throw new Error('BASE_URL must be a valid public origin, for example https://your-store.example.'); }
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password || parsed.pathname !== '/' || parsed.search || parsed.hash) {
    throw new Error('BASE_URL must be an HTTP(S) origin without credentials, a path, query or fragment.');
  }
  if (production && parsed.protocol !== 'https:') throw new Error('Production BASE_URL must use HTTPS.');
  return parsed.origin;
}

export function resolveEncryptionKey({ encryptionKey, dataDir, db, env = process.env }) {
  const keyPath = resolve(dataDir, '.encryption-key');
  const supplied = encryptionKey ?? env.ENCRYPTION_KEY;
  let key = String(supplied || '').trim();
  const encrypted = [
    ...db.prepare('SELECT config FROM gateways').all().map(row => row.config),
    ...db.prepare("SELECT json_extract(data, '$.paymentConfig') AS config FROM orders WHERE json_extract(data, '$.paymentConfig') IS NOT NULL").all().map(row => row.config)
  ];
  if (key && !validKey(key)) throw new Error('ENCRYPTION_KEY must contain exactly 64 hexadecimal characters.');
  if (!key) {
    try { key = readFileSync(keyPath, 'utf8').trim(); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (key && !validKey(key)) throw new Error('The saved encryption key is invalid. Restore its original value; do not replace it while encrypted records exist.');
    if (!key) {
      if (encrypted.length) throw new Error('Encrypted payment records exist but their key is missing. Restore the original ENCRYPTION_KEY or data-directory .encryption-key file.');
      const temporary = `${keyPath}.${randomBytes(12).toString('hex')}.tmp`;
      const generated = randomBytes(32).toString('hex');
      try {
        writeFileSync(temporary, generated + '\n', { mode: 0o600, flag: 'wx', flush: true });
        // Publish a complete key atomically; another process's key is never overwritten.
        try { linkSync(temporary, keyPath); }
        catch (error) { if (error.code !== 'EEXIST') throw error; }
      } finally {
        try { unlinkSync(temporary); } catch (error) { if (error.code !== 'ENOENT') throw error; }
      }
      key = readFileSync(keyPath, 'utf8').trim();
      if (!validKey(key)) throw new Error('The saved encryption key is invalid. Restore the original key.');
    }
    chmodSync(keyPath, 0o600);
  }
  try { for (const value of encrypted) decrypt(value, key); }
  catch { throw new Error('The encryption key does not match existing payment records. Restore the original key; stored credentials have not been changed.'); }
  return key;
}
