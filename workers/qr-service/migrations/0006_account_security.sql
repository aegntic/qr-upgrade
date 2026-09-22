-- Durable revocation state is independent of the short-lived security history.
CREATE TABLE account_security (
 owner TEXT PRIMARY KEY CHECK(length(owner)=64),
 session_version INTEGER NOT NULL DEFAULT 1 CHECK(session_version BETWEEN 1 AND 9007199254740991)
);
CREATE TABLE account_security_events (
 id TEXT PRIMARY KEY,
 owner TEXT NOT NULL REFERENCES account_security(owner),
 type TEXT NOT NULL CHECK(type IN ('sign_in','sign_out_everywhere','data_export','account_deletion')),
 created_at INTEGER NOT NULL
);
CREATE INDEX account_security_events_owner_time ON account_security_events(owner,created_at DESC,id DESC);
CREATE INDEX account_security_events_time ON account_security_events(created_at);
