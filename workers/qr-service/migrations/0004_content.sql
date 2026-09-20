CREATE TABLE content_pages(id TEXT PRIMARY KEY, owner TEXT NOT NULL, slug TEXT UNIQUE NOT NULL, draft TEXT NOT NULL, published TEXT, status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published','paused')), archived INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE INDEX content_pages_owner ON content_pages(owner);
CREATE TABLE content_assets(id TEXT PRIMARY KEY, owner TEXT NOT NULL, name TEXT NOT NULL, mime TEXT NOT NULL, size INTEGER NOT NULL, r2key TEXT UNIQUE NOT NULL, ready INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL);
CREATE INDEX content_assets_owner ON content_assets(owner);
CREATE TABLE content_submissions(id TEXT PRIMARY KEY, page_id TEXT NOT NULL REFERENCES content_pages(id), name TEXT NOT NULL, email TEXT NOT NULL, message TEXT NOT NULL, created_at TEXT NOT NULL, network TEXT);
CREATE INDEX content_submissions_page ON content_submissions(page_id,created_at);
CREATE TABLE content_network_quotas(network TEXT NOT NULL, hour TEXT NOT NULL, count INTEGER NOT NULL, PRIMARY KEY(network,hour));
CREATE TRIGGER content_submission_quota AFTER INSERT ON content_submissions BEGIN
 INSERT INTO content_network_quotas(network,hour,count) VALUES(NEW.network,substr(NEW.created_at,1,13),1) ON CONFLICT(network,hour) DO UPDATE SET count=count+1;
 UPDATE content_submissions SET network=NULL WHERE id=NEW.id;
END;
