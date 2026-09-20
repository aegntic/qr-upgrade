-- Private account library; owner is SHA-256 of the verified Google subject.
CREATE TABLE IF NOT EXISTS cloud_designs (
 id TEXT PRIMARY KEY,
 owner TEXT NOT NULL,
 name TEXT NOT NULL,
 archived INTEGER NOT NULL DEFAULT 0 CHECK (archived IN (0,1)),
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL,
 r2key TEXT NOT NULL,
 ready INTEGER NOT NULL DEFAULT 0 CHECK (ready IN (0,1))
);
CREATE INDEX IF NOT EXISTS cloud_designs_owner ON cloud_designs(owner,updated_at);
