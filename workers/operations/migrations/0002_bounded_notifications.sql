-- Keep the current logical pair, plus at most one older send already in flight.
DROP TRIGGER open_notification;
DROP TRIGGER recovery_notification;

-- Upgrade existing inventories before installing the hard limits. Suppression is terminal history.
UPDATE notifications SET state='abandoned',terminal_at=MAX(transition_at,(SELECT updated_at FROM monitor_state WHERE component=notifications.component)),lease_until=NULL
WHERE state='pending' AND incident_seq<>(SELECT incident_seq FROM monitor_state WHERE component=notifications.component);
UPDATE notifications SET state='abandoned',terminal_at=MAX(transition_at,(SELECT updated_at FROM monitor_state WHERE component=notifications.component)),lease_until=NULL
WHERE state='leased' AND (lease_until<=(SELECT updated_at FROM monitor_state WHERE component=notifications.component)
 OR EXISTS(SELECT 1 FROM notifications newer WHERE newer.component=notifications.component AND newer.state='leased' AND
 (newer.incident_seq>notifications.incident_seq OR (newer.incident_seq=notifications.incident_seq AND newer.kind='recovery' AND notifications.kind='incident'))));
UPDATE notifications SET state='abandoned',terminal_at=MAX(transition_at,(SELECT updated_at FROM monitor_state WHERE component=notifications.component)),lease_until=NULL
WHERE state='pending' AND kind='recovery' AND NOT EXISTS(SELECT 1 FROM notifications i WHERE i.component=notifications.component AND i.incident_seq=notifications.incident_seq AND i.kind='incident' AND i.state IN ('pending','leased','accepted'));

CREATE UNIQUE INDEX one_lease_per_component ON notifications(component) WHERE state='leased';
CREATE INDEX notification_outstanding ON notifications(component,incident_seq) WHERE state IN ('pending','leased');
CREATE TRIGGER bounded_notification_insert BEFORE INSERT ON notifications
WHEN NEW.state IN ('pending','leased') AND (
 NEW.incident_seq<>(SELECT incident_seq FROM monitor_state WHERE component=NEW.component)
  OR (SELECT COUNT(*) FROM notifications WHERE component=NEW.component AND state IN ('pending','leased'))>=3
  OR (NEW.state='pending' AND (SELECT COUNT(*) FROM notifications WHERE component=NEW.component AND state='pending')>=2)
)
BEGIN
 SELECT RAISE(ABORT,'notification inventory bound');
END;
CREATE TRIGGER bounded_notification_update BEFORE UPDATE ON notifications
WHEN NEW.state IN ('pending','leased') AND (
 (NEW.state='pending' AND NEW.incident_seq<>(SELECT incident_seq FROM monitor_state WHERE component=NEW.component))
  OR (SELECT COUNT(*) FROM notifications WHERE component=NEW.component AND state IN ('pending','leased')
      AND NOT (component=OLD.component AND incident_seq=OLD.incident_seq AND kind=OLD.kind))>=3
  OR (NEW.state='pending' AND (SELECT COUNT(*) FROM notifications WHERE component=NEW.component AND state='pending'
      AND NOT (component=OLD.component AND incident_seq=OLD.incident_seq AND kind=OLD.kind))>=2)
)
BEGIN
 SELECT RAISE(ABORT,'notification inventory bound');
END;
CREATE TRIGGER abandon_unaccepted_recovery AFTER UPDATE OF state ON notifications
WHEN NEW.kind='incident' AND NEW.state='abandoned'
BEGIN
 UPDATE notifications SET state='abandoned',terminal_at=NEW.terminal_at,lease_until=NULL
 WHERE component=NEW.component AND incident_seq=NEW.incident_seq AND kind='recovery' AND state='pending';
END;
CREATE TRIGGER open_notification AFTER UPDATE ON monitor_state
WHEN NEW.phase='open' AND OLD.phase IN ('healthy','suspect')
BEGIN
 UPDATE notifications SET state='abandoned',terminal_at=NEW.updated_at,lease_until=NULL
 WHERE component=NEW.component AND incident_seq<NEW.incident_seq
 AND (state='pending' OR (state='leased' AND lease_until<=NEW.updated_at));
 INSERT INTO notifications VALUES(NEW.component,NEW.incident_seq,'incident','pending',0,NEW.updated_at,NEW.updated_at,NULL,NULL);
END;
CREATE TRIGGER recovery_notification AFTER UPDATE ON monitor_state
WHEN NEW.phase='healthy' AND OLD.phase IN ('open','recovering')
BEGIN
 -- Conditional inserts avoid nested expression terminators in remote SQL query parsing.
 INSERT INTO notifications
 SELECT NEW.component,NEW.incident_seq,'recovery','pending',0,NEW.updated_at,NEW.updated_at,NULL,NULL
 WHERE EXISTS(SELECT 1 FROM notifications WHERE component=NEW.component AND incident_seq=NEW.incident_seq AND kind='incident' AND state IN ('pending','leased','accepted'));
 INSERT INTO notifications
 SELECT NEW.component,NEW.incident_seq,'recovery','abandoned',0,NEW.updated_at,NEW.updated_at,NULL,NEW.updated_at
 WHERE NOT EXISTS(SELECT 1 FROM notifications WHERE component=NEW.component AND incident_seq=NEW.incident_seq AND kind='incident' AND state IN ('pending','leased','accepted'));
END;
