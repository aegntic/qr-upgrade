CREATE TABLE billing_customers (
 owner TEXT PRIMARY KEY CHECK(length(owner)=64),
 customer_id TEXT NOT NULL UNIQUE,
 mode TEXT NOT NULL CHECK(mode IN ('test','live')),
 reservation TEXT,
 tier TEXT CHECK(tier IN ('pro','brand')),
 reserved_at INTEGER,
 session_id TEXT,
 lease_until INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE billing_events (
 id TEXT PRIMARY KEY,
 type TEXT NOT NULL,
 created INTEGER NOT NULL,
 customer_id TEXT NOT NULL REFERENCES billing_customers(customer_id),
 subscription_id TEXT,
 mode TEXT NOT NULL CHECK(mode IN ('test','live'))
);
