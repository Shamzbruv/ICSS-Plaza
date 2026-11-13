-- Private transactional email outbox and support inbox.

CREATE TABLE IF NOT EXISTS icss_plaza.email_outbox (
 id TEXT PRIMARY KEY, payload TEXT NOT NULL, status TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0,
 next_attempt BIGINT NOT NULL, created BIGINT NOT NULL, expires BIGINT NOT NULL,
 provider_id TEXT, last_error TEXT
);
CREATE INDEX IF NOT EXISTS email_outbox_due ON icss_plaza.email_outbox(status,next_attempt);
CREATE TABLE IF NOT EXISTS icss_plaza.email_inbound (
 id TEXT PRIMARY KEY, payload TEXT NOT NULL, created BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS email_inbound_recent ON icss_plaza.email_inbound(created);
ALTER TABLE icss_plaza.email_outbox ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON icss_plaza.email_outbox FROM PUBLIC, anon, authenticated, service_role;
ALTER TABLE icss_plaza.email_inbound ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON icss_plaza.email_inbound FROM PUBLIC, anon, authenticated, service_role;
