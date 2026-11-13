export const trustSchema = `
CREATE TABLE IF NOT EXISTS vendor_reports(
 id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL REFERENCES tenants(id), access_hash TEXT NOT NULL,
 reason TEXT NOT NULL, priority TEXT NOT NULL, status TEXT NOT NULL, payload TEXT NOT NULL,
 outcome TEXT, version INTEGER NOT NULL DEFAULT 1, legal_hold INTEGER NOT NULL DEFAULT 0,
 vendor_visible INTEGER NOT NULL DEFAULT 0, created BIGINT NOT NULL, updated BIGINT NOT NULL, closed BIGINT
);
CREATE TABLE IF NOT EXISTS vendor_report_events(
 id TEXT PRIMARY KEY, report_id TEXT NOT NULL REFERENCES vendor_reports(id) ON DELETE CASCADE,
 audience TEXT NOT NULL, author TEXT NOT NULL, kind TEXT NOT NULL, payload TEXT NOT NULL, created BIGINT NOT NULL
);
CREATE TABLE IF NOT EXISTS vendor_report_evidence(
 id TEXT PRIMARY KEY, report_id TEXT NOT NULL REFERENCES vendor_reports(id) ON DELETE CASCADE,
 name TEXT NOT NULL, mime TEXT NOT NULL, payload TEXT NOT NULL, created BIGINT NOT NULL
);
CREATE TABLE IF NOT EXISTS vendor_restrictions(
 tenant_id TEXT PRIMARY KEY REFERENCES tenants(id), report_id TEXT REFERENCES vendor_reports(id) ON DELETE SET NULL,
 mode TEXT NOT NULL, updated BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS vendor_reports_queue ON vendor_reports(status, updated);
CREATE INDEX IF NOT EXISTS vendor_reports_vendor ON vendor_reports(tenant_id, vendor_visible, updated);
CREATE INDEX IF NOT EXISTS vendor_reports_retention ON vendor_reports(closed) WHERE legal_hold=0;
CREATE INDEX IF NOT EXISTS vendor_report_events_case ON vendor_report_events(report_id, created);
CREATE INDEX IF NOT EXISTS vendor_report_evidence_case ON vendor_report_evidence(report_id);
`;
