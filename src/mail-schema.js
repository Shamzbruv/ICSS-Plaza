export const mailSchema = `
CREATE TABLE IF NOT EXISTS email_outbox (
 id TEXT PRIMARY KEY, payload TEXT NOT NULL, status TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0,
 next_attempt BIGINT NOT NULL, created BIGINT NOT NULL, expires BIGINT NOT NULL,
 provider_id TEXT, last_error TEXT
);
CREATE INDEX IF NOT EXISTS email_outbox_due ON email_outbox(status,next_attempt);
CREATE TABLE IF NOT EXISTS email_inbound (
 id TEXT PRIMARY KEY, payload TEXT NOT NULL, created BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS email_inbound_recent ON email_inbound(created);
`;
