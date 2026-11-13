-- Private consultations and platform rental billing.

CREATE TABLE IF NOT EXISTS icss_plaza.plaza_consultations (
 id TEXT PRIMARY KEY, payload TEXT NOT NULL, status TEXT NOT NULL, created BIGINT NOT NULL, updated BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS plaza_consultations_queue ON icss_plaza.plaza_consultations(status,created);
CREATE TABLE IF NOT EXISTS icss_plaza.plaza_plans (
 id TEXT PRIMARY KEY, name TEXT NOT NULL, amount INTEGER NOT NULL, currency TEXT NOT NULL,
 paypal_plan TEXT NOT NULL, enabled INTEGER NOT NULL, created BIGINT NOT NULL
);
CREATE TABLE IF NOT EXISTS icss_plaza.plaza_rentals (
 id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL REFERENCES icss_plaza.tenants(id), plan_id TEXT NOT NULL REFERENCES icss_plaza.plaza_plans(id),
 provider TEXT NOT NULL, amount INTEGER NOT NULL, currency TEXT NOT NULL, provider_plan TEXT NOT NULL,
 provider_id TEXT UNIQUE, status TEXT NOT NULL, paid_until BIGINT NOT NULL DEFAULT 0, created BIGINT NOT NULL, updated BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS plaza_rentals_tenant ON icss_plaza.plaza_rentals(tenant_id,created);
CREATE TABLE IF NOT EXISTS icss_plaza.plaza_billing_events (
 id TEXT PRIMARY KEY, rental_id TEXT NOT NULL REFERENCES icss_plaza.plaza_rentals(id), kind TEXT NOT NULL, created BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS plaza_billing_rental ON icss_plaza.plaza_billing_events(rental_id,created);
ALTER TABLE icss_plaza.plaza_consultations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON icss_plaza.plaza_consultations FROM PUBLIC, anon, authenticated, service_role;
ALTER TABLE icss_plaza.plaza_plans ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON icss_plaza.plaza_plans FROM PUBLIC, anon, authenticated, service_role;
ALTER TABLE icss_plaza.plaza_rentals ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON icss_plaza.plaza_rentals FROM PUBLIC, anon, authenticated, service_role;
ALTER TABLE icss_plaza.plaza_billing_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON icss_plaza.plaza_billing_events FROM PUBLIC, anon, authenticated, service_role;
