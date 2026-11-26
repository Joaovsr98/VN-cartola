-- Closed beta, isolated from all demo leagues and scores.
CREATE TABLE beta_invites (hash TEXT PRIMARY KEY,created_at INTEGER NOT NULL,expires_at INTEGER NOT NULL);
CREATE TABLE beta_members (id TEXT PRIMARY KEY,invite_hash TEXT NOT NULL UNIQUE REFERENCES beta_invites(hash),access_hash TEXT NOT NULL UNIQUE,team_name TEXT NOT NULL,external_id TEXT NOT NULL UNIQUE,status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),created_at INTEGER NOT NULL);
CREATE TABLE beta_sessions (hash TEXT PRIMARY KEY,member_id TEXT NOT NULL REFERENCES beta_members(id),expires_at INTEGER NOT NULL);
CREATE INDEX beta_sessions_expiry ON beta_sessions(expires_at);
CREATE TABLE beta_scores (member_id TEXT NOT NULL REFERENCES beta_members(id),round INTEGER NOT NULL CHECK(round BETWEEN 1 AND 38),points INTEGER NOT NULL CHECK(points BETWEEN -100000 AND 100000),PRIMARY KEY(member_id,round));
CREATE TABLE beta_audit (id INTEGER PRIMARY KEY,member_id TEXT NOT NULL REFERENCES beta_members(id),action TEXT NOT NULL,detail TEXT NOT NULL,created_at INTEGER NOT NULL);
INSERT INTO arena_meta VALUES ('beta','1');
