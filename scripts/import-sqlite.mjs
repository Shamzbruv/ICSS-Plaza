import { createPostgresPool, openPostgres } from '../src/database.js';
import { importSqlite } from '../src/postgres-cutover.js';

if (!process.argv[2] || !process.env.DATABASE_URL) {
  console.error('Usage: set DATABASE_URL and ENCRYPTION_KEY, then run npm run db:import -- /path/to/plaza.sqlite');
  process.exit(1);
}
let db;
try {
  db = openPostgres(createPostgresPool(process.env.DATABASE_URL, true));
  const counts = await importSqlite(db, process.argv[2], process.env.ENCRYPTION_KEY);
  console.log('SQLite import complete. Verified row counts:', counts);
} catch (error) {
  console.error('SQLite import failed:', error.code || error.message);
  process.exitCode = 1;
} finally { await db?.close(); }
