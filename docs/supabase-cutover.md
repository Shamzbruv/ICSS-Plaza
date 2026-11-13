# Connect ICSS Plaza to Supabase

The application runs its existing Node API, sign-in and tenant access controls.
When `DATABASE_URL` is set, users, sessions, stores, products, orders, payment
settings, images and audit records are stored in Supabase Postgres. The browser
never connects to the database. Keep `icss_plaza` off the Supabase Data API.
Plaza remains a one-replica service because payment retries and rate limits
also use in-process state.

## Prepare the database

1. Open the dedicated ICSS Plaza project. Apply
   [the backend migration](../supabase/migrations/20261113163846_icss_plaza_backend.sql)
   and the [vendor trust migration](../supabase/migrations/20261113163850_vendor_trust.sql)
   and [email migration](../supabase/migrations/20261113165453_resend_mail.sql)
   in that order through the Supabase migration workflow.
2. From **Connect → Session pooler**, copy the Postgres URI and substitute the
   database password, URL-encoding it if required. Use port 5432. The app verifies
   the database server's TLS certificate in production. Do not use an API key
   or a personal access token as a database password.
3. Keep the URI and a stable 64-hex-character `ENCRYPTION_KEY` in protected
   deployment variables. On a new installation, generate the key with
   `openssl rand -hex 32`. On an existing installation, use the original
   `ENCRYPTION_KEY` or the original `DATA_DIR/.encryption-key` value.

## Existing Railway installation

1. Confirm the persistent volume and identify the active SQLite database.
   Pause storefront/admin writes before taking the final SQLite snapshot and
   keep writes paused until the Postgres service is verified. Use SQLite's
   backup API or a consistent volume snapshot; do not copy a live WAL database
   file alone. Keep an off-service protected copy of the snapshot and key.
2. From a trusted machine that can access Supabase, use Node.js 24 and
   `npm ci --ignore-scripts`. Set `DATABASE_URL` and the original
   `ENCRYPTION_KEY` privately, then run
   `npm run db:import -- /path/to/plaza.sqlite`. The import requires an empty
   target, validates SQLite integrity, checks row counts, verifies encrypted
   settings against the original key, and commits all records together.
3. Configure `DATABASE_URL`, `ENCRYPTION_KEY` and `REQUIRE_POSTGRES=1` in Railway
   for ICSS Plaza. Keep its existing `OPERATOR_EMAIL`, `BASE_URL` and volume
   settings. Redeploy the GitHub service. For a verified fresh installation
   with no SQLite records, skip the backup/import steps.
4. Check `/api/health`, an existing merchant login, its storefront and images,
   and a controlled order. Keep the SQLite volume and backups. If you must
   return to SQLite after taking new Postgres orders, reconcile those writes
   first; reverting variables does not copy Postgres records back.

A deployment with no `DATABASE_URL` continues using SQLite. After switching,
`REQUIRE_POSTGRES=1` prevents accidental fallback if the URI is removed. If
the existing volume contains records, the app refuses to start on Postgres
until a completed import is present.
