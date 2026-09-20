CREATE TABLE IF NOT EXISTS art_jobs (
 id TEXT PRIMARY KEY,
 owner TEXT NOT NULL,
 network TEXT NOT NULL,
 day TEXT NOT NULL,
 state TEXT NOT NULL CHECK(state IN ('pending','ready','failed','expired')),
 created_at INTEGER NOT NULL,
 image TEXT,
 error TEXT
);
CREATE INDEX IF NOT EXISTS art_jobs_day ON art_jobs(day);
CREATE INDEX IF NOT EXISTS art_jobs_network_day ON art_jobs(network, day);
