import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createPostgresPool, openPostgres, openSqlite } from '../src/database.js';
import { assertPostgresCutover, importSqlite, postgresKey } from '../src/postgres-cutover.js';
import { encrypt } from '../src/model.js';

const url = process.env.PLAZA_TEST_DATABASE_URL;
test('SQLite import preserves encrypted data and images; wrong key rolls back all records', { skip: !url }, async () => {
  const dir = mkdtempSync(join(tmpdir(), 'plaza-import-test-'));
  const key = 'ca'.repeat(32);
  const image = Buffer.from([0, 137, 80, 78, 71, 255]);
  const admin = createPostgresPool(url, false);
  const dbName = 'plaza_import_test';
  let postgres;
  let created = false;
  try {
    await admin.query('CREATE DATABASE ' + dbName);
    created = true;
    const migratedURL = new URL(url);
    migratedURL.pathname = '/' + dbName;
    const pool = createPostgresPool(migratedURL.toString(), false);
    postgres = openPostgres(pool);
    const { readFile } = await import('node:fs/promises');
    await pool.query(await readFile(new URL('../supabase/migrations/20261113141000_icss_plaza_backend.sql', import.meta.url), 'utf8'));
    await pool.query(await readFile(new URL('../supabase/migrations/20261113162000_vendor_trust.sql', import.meta.url), 'utf8'));
    const sqlite = openSqlite(dir);
    try {
      await sqlite.run('INSERT INTO users VALUES(?,?,?,?)','owner','owner@example.com','hashed',Date.now());
      await sqlite.run('INSERT INTO tenants VALUES(?,?,?,?,?,?,?)','tenant','test-shop','owner','active',Date.now(),'{}',Date.now());
      await sqlite.run('INSERT INTO sessions VALUES(?,?,?,?)','session','owner','csrf',Date.now()+10000);
      await sqlite.run('INSERT INTO gateways VALUES(?,?,?,?)','tenant','bank',1,encrypt({ instructions:'example' },key));
      await sqlite.run('INSERT INTO vendor_reports(id,tenant_id,access_hash,reason,priority,status,payload,created,updated) VALUES(?,?,?,?,?,?,?,?,?)','report','tenant','hash','fraud','high','received',encrypt({email:'case@example.com'},key),Date.now(),Date.now());
      await sqlite.run('INSERT INTO vendor_restrictions VALUES(?,?,?,?)','tenant','report','checkout',Date.now());
      await sqlite.run('INSERT INTO images VALUES(?,?,?,?,?,?)','image','tenant','image/png','pixel.png',image,Date.now());
    } finally { await sqlite.close(); }
    const path = join(dir, 'plaza.sqlite');
    await assert.rejects(assertPostgresCutover(postgres, dir), /must be imported/);
    await assert.rejects(importSqlite(postgres,path,'12'.repeat(32)), /does not match/);
    assert.equal((await postgres.one('SELECT COUNT(*) AS n FROM users')).n, 0);
    const counts = await importSqlite(postgres,path,key);
    for (const table of ['users','tenants','sessions','gateways','images','vendor_reports','vendor_restrictions']) assert.equal(counts[table],1);
    assert.deepEqual((await postgres.one('SELECT bytes FROM images WHERE id=?','image')).bytes, image);
    assert.equal((await postgres.one('SELECT user_id FROM sessions WHERE token=?','session')).user_id,'owner');
    await assertPostgresCutover(postgres,dir);
    assert.equal(await postgresKey(postgres,key),key);
    await assert.rejects(importSqlite(postgres,path,key), /already has a completed/);
  } finally {
    await postgres?.close();
    if(created) await admin.query('DROP DATABASE ' + dbName);
    await admin.end();
    rmSync(dir,{recursive:true,force:true});
  }
});
