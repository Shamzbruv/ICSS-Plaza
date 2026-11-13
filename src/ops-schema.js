export const opsSchema = `
CREATE TABLE IF NOT EXISTS plaza_consultations (
 id TEXT PRIMARY KEY, payload TEXT NOT NULL, status TEXT NOT NULL, created BIGINT NOT NULL, updated BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS plaza_consultations_queue ON plaza_consultations(status,created);
CREATE TABLE IF NOT EXISTS plaza_plans (
 id TEXT PRIMARY KEY, name TEXT NOT NULL, amount INTEGER NOT NULL, currency TEXT NOT NULL,
 paypal_plan TEXT NOT NULL, enabled INTEGER NOT NULL, created BIGINT NOT NULL
);
CREATE TABLE IF NOT EXISTS plaza_rentals (
 id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL REFERENCES tenants(id), plan_id TEXT NOT NULL REFERENCES plaza_plans(id),
 provider TEXT NOT NULL, amount INTEGER NOT NULL, currency TEXT NOT NULL, provider_plan TEXT NOT NULL,
 provider_id TEXT UNIQUE, status TEXT NOT NULL, paid_until BIGINT NOT NULL DEFAULT 0, created BIGINT NOT NULL, updated BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS plaza_rentals_tenant ON plaza_rentals(tenant_id,created);
CREATE TABLE IF NOT EXISTS plaza_billing_events (
 id TEXT PRIMARY KEY, rental_id TEXT NOT NULL REFERENCES plaza_rentals(id), kind TEXT NOT NULL, created BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS plaza_billing_rental ON plaza_billing_events(rental_id,created);
`;
