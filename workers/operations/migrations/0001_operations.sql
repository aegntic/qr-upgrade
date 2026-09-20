CREATE TABLE error_rollups (
 bucket_start INTEGER NOT NULL CHECK(typeof(bucket_start)='integer' AND (bucket_start >= 0 AND bucket_start % 300 = 0)),
 producer TEXT NOT NULL CHECK(producer IN ('web','service')),
 route_class TEXT NOT NULL,
 status_class TEXT NOT NULL CHECK(status_class IN ('none','5xx')),
 outcome_class TEXT NOT NULL CHECK(outcome_class IN ('ok','exception','cpu','memory','script','other')),
 occurrences INTEGER NOT NULL CHECK(typeof(occurrences)='integer' AND (occurrences BETWEEN 1 AND 1000000)),
 CHECK(status_class='5xx' OR outcome_class IN ('exception','cpu','memory','script')),
 CHECK((producer='web' AND route_class IN ('html','api','billing_webhook','published','redirect','static','other')) OR
       (producer='service' AND route_class IN ('health','private_api','public_content','redirect','scheduled','other'))),
 PRIMARY KEY(bucket_start,producer,route_class,status_class,outcome_class)
) WITHOUT ROWID;
CREATE TABLE monitor_state (
 component TEXT PRIMARY KEY CHECK(component IN ('web_probe','service_probe','web_runtime','service_runtime')),
 phase TEXT NOT NULL CHECK(phase IN ('healthy','suspect','open','recovering')),
 failure_streak INTEGER NOT NULL CHECK(typeof(failure_streak)='integer' AND (failure_streak BETWEEN 0 AND 2)),
 success_streak INTEGER NOT NULL CHECK(typeof(success_streak)='integer' AND (success_streak BETWEEN 0 AND 3)),
 incident_seq INTEGER NOT NULL CHECK(typeof(incident_seq)='integer' AND (incident_seq BETWEEN 0 AND 1000000000)),
 last_signal TEXT NOT NULL CHECK(last_signal IN ('none','probe_http','probe_timeout','probe_shape','runtime_5xx','runtime_fatal')),
 opened_at INTEGER CHECK((opened_at IS NULL OR typeof(opened_at)='integer') AND (opened_at IS NULL OR opened_at >= 0)),
 updated_at INTEGER NOT NULL CHECK(typeof(updated_at)='integer' AND (updated_at >= 0)),
 last_bucket INTEGER NOT NULL CHECK(typeof(last_bucket)='integer' AND (last_bucket >= -300 AND last_bucket % 300 = 0)),
 revision INTEGER NOT NULL CHECK(typeof(revision)='integer' AND (revision >= 0))
) WITHOUT ROWID;
INSERT INTO monitor_state SELECT 'web_probe','healthy',0,0,0,'none',NULL,0,-300,0;
INSERT INTO monitor_state SELECT 'service_probe','healthy',0,0,0,'none',NULL,0,-300,0;
INSERT INTO monitor_state SELECT 'web_runtime','healthy',0,0,0,'none',NULL,0,-300,0;
INSERT INTO monitor_state SELECT 'service_runtime','healthy',0,0,0,'none',NULL,0,-300,0;
CREATE TRIGGER keep_monitor_rows BEFORE DELETE ON monitor_state BEGIN SELECT RAISE(ABORT,'fixed monitor rows'); END;
CREATE TRIGGER keep_monitor_components BEFORE UPDATE OF component ON monitor_state BEGIN SELECT RAISE(ABORT,'fixed monitor components'); END;
CREATE TABLE notifications (
 component TEXT NOT NULL CHECK(component IN ('web_probe','service_probe','web_runtime','service_runtime')) REFERENCES monitor_state(component),
 incident_seq INTEGER NOT NULL CHECK(typeof(incident_seq)='integer' AND (incident_seq BETWEEN 1 AND 1000000000)),
 kind TEXT NOT NULL CHECK(kind IN ('incident','recovery')),
 state TEXT NOT NULL CHECK(state IN ('pending','leased','accepted','abandoned')),
 attempts INTEGER NOT NULL CHECK(typeof(attempts)='integer' AND (attempts BETWEEN 0 AND 3)),
 transition_at INTEGER NOT NULL CHECK(typeof(transition_at)='integer' AND (transition_at >= 0)),
 next_attempt_at INTEGER NOT NULL CHECK(typeof(next_attempt_at)='integer' AND (next_attempt_at >= 0)),
 lease_until INTEGER CHECK((lease_until IS NULL OR typeof(lease_until)='integer') AND (lease_until IS NULL OR lease_until >= 0)),
 terminal_at INTEGER CHECK((terminal_at IS NULL OR typeof(terminal_at)='integer') AND (terminal_at IS NULL OR terminal_at >= 0)),
 PRIMARY KEY(component,incident_seq,kind)
) WITHOUT ROWID;
-- Enqueue inside the SAME SQLite/D1 transaction as the state mutation, including CAS updates.
CREATE TRIGGER open_notification AFTER UPDATE ON monitor_state
WHEN NEW.phase='open' AND OLD.phase IN ('healthy','suspect')
BEGIN
 INSERT INTO notifications VALUES(NEW.component,NEW.incident_seq,'incident','pending',0,NEW.updated_at,NEW.updated_at,NULL,NULL);
END;
CREATE TRIGGER recovery_notification AFTER UPDATE ON monitor_state
WHEN NEW.phase='healthy' AND OLD.phase IN ('open','recovering')
BEGIN
 INSERT INTO notifications VALUES(NEW.component,NEW.incident_seq,'recovery','pending',0,NEW.updated_at,NEW.updated_at,NULL,NULL);
END;
CREATE INDEX notification_due ON notifications(state,next_attempt_at);
