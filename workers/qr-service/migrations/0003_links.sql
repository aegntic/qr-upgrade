CREATE TABLE dynamic_links (
 id TEXT PRIMARY KEY, owner TEXT NOT NULL, slug TEXT NOT NULL UNIQUE,
 name TEXT NOT NULL, target TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published','paused')),
 archived INTEGER NOT NULL DEFAULT 0 CHECK(archived IN (0,1)),
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE INDEX dynamic_links_owner ON dynamic_links(owner,created_at);
CREATE TABLE link_daily_counts (
 slug TEXT NOT NULL REFERENCES dynamic_links(slug), day TEXT NOT NULL,
 count INTEGER NOT NULL DEFAULT 0 CHECK(count>=0), PRIMARY KEY(slug,day)
);
