-- Developer grants and time-bound vendor support.

CREATE TABLE IF NOT EXISTS icss_plaza.plaza_developers (
 user_id TEXT PRIMARY KEY REFERENCES icss_plaza.users(id), enabled INTEGER NOT NULL DEFAULT 1, created BIGINT NOT NULL
);
CREATE TABLE IF NOT EXISTS icss_plaza.plaza_vendor_access (
 id TEXT PRIMARY KEY, operator_id TEXT NOT NULL REFERENCES icss_plaza.users(id), tenant_id TEXT NOT NULL REFERENCES icss_plaza.tenants(id),
 session_hash TEXT NOT NULL, purpose TEXT NOT NULL, created BIGINT NOT NULL, expires BIGINT NOT NULL, ended BIGINT
);
CREATE INDEX IF NOT EXISTS plaza_vendor_access_actor ON icss_plaza.plaza_vendor_access(operator_id,tenant_id,created);
ALTER TABLE icss_plaza.plaza_developers ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON icss_plaza.plaza_developers FROM PUBLIC, anon, authenticated, service_role;
ALTER TABLE icss_plaza.plaza_vendor_access ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON icss_plaza.plaza_vendor_access FROM PUBLIC, anon, authenticated, service_role;
