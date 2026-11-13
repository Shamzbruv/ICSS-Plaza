-- Private vendor case files and storefront restrictions.

CREATE TABLE IF NOT EXISTS icss_plaza.vendor_reports(
 id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL REFERENCES icss_plaza.tenants(id), access_hash TEXT NOT NULL,
 reason TEXT NOT NULL, priority TEXT NOT NULL, status TEXT NOT NULL, payload TEXT NOT NULL,
 outcome TEXT, version INTEGER NOT NULL DEFAULT 1, legal_hold INTEGER NOT NULL DEFAULT 0,
 vendor_visible INTEGER NOT NULL DEFAULT 0, created BIGINT NOT NULL, updated BIGINT NOT NULL, closed BIGINT
);
CREATE TABLE IF NOT EXISTS icss_plaza.vendor_report_events(
 id TEXT PRIMARY KEY, report_id TEXT NOT NULL REFERENCES icss_plaza.vendor_reports(id) ON DELETE CASCADE,
 audience TEXT NOT NULL, author TEXT NOT NULL, kind TEXT NOT NULL, payload TEXT NOT NULL, created BIGINT NOT NULL
);
CREATE TABLE IF NOT EXISTS icss_plaza.vendor_report_evidence(
 id TEXT PRIMARY KEY, report_id TEXT NOT NULL REFERENCES icss_plaza.vendor_reports(id) ON DELETE CASCADE,
 name TEXT NOT NULL, mime TEXT NOT NULL, payload TEXT NOT NULL, created BIGINT NOT NULL
);
CREATE TABLE IF NOT EXISTS icss_plaza.vendor_restrictions(
 tenant_id TEXT PRIMARY KEY REFERENCES icss_plaza.tenants(id), report_id TEXT REFERENCES icss_plaza.vendor_reports(id) ON DELETE SET NULL,
 mode TEXT NOT NULL, updated BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS vendor_reports_queue ON icss_plaza.vendor_reports(status, updated);
CREATE INDEX IF NOT EXISTS vendor_reports_vendor ON icss_plaza.vendor_reports(tenant_id, vendor_visible, updated);
CREATE INDEX IF NOT EXISTS vendor_reports_retention ON icss_plaza.vendor_reports(closed) WHERE legal_hold=0;
CREATE INDEX IF NOT EXISTS vendor_report_events_case ON icss_plaza.vendor_report_events(report_id, created);
CREATE INDEX IF NOT EXISTS vendor_report_evidence_case ON icss_plaza.vendor_report_evidence(report_id);
ALTER TABLE icss_plaza.vendor_reports ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON icss_plaza.vendor_reports FROM PUBLIC, anon, authenticated, service_role;
ALTER TABLE icss_plaza.vendor_report_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON icss_plaza.vendor_report_events FROM PUBLIC, anon, authenticated, service_role;
ALTER TABLE icss_plaza.vendor_report_evidence ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON icss_plaza.vendor_report_evidence FROM PUBLIC, anon, authenticated, service_role;
ALTER TABLE icss_plaza.vendor_restrictions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON icss_plaza.vendor_restrictions FROM PUBLIC, anon, authenticated, service_role;
