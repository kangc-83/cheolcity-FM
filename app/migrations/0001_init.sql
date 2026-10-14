CREATE TABLE IF NOT EXISTS app_config (key TEXT PRIMARY KEY, value TEXT NOT NULL);
INSERT OR IGNORE INTO app_config (key, value) VALUES ('setup_code_hash', '4b0e04e1fcbc4ed7d7c7d0e4ba95fe40222622ca3871910bd5f0c33c7b2f2d23');
CREATE TABLE IF NOT EXISTS users (
 id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE, display_name TEXT NOT NULL,
 password_hash TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('admin','member')),
 player_id TEXT, active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS sessions (
 token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 expires_at TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE TABLE IF NOT EXISTS players (
 id TEXT PRIMARY KEY, number INTEGER NOT NULL UNIQUE, name TEXT NOT NULL,
 phone TEXT, status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','rest','left')),
 note TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS gatherings (
 id TEXT PRIMARY KEY, event_date TEXT NOT NULL, title TEXT NOT NULL DEFAULT '정기 모임',
 location TEXT, status TEXT NOT NULL DEFAULT 'scheduled' CHECK(status IN ('scheduled','completed','cancelled')),
 note TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_gatherings_date ON gatherings(event_date);
CREATE TABLE IF NOT EXISTS attendance (
 gathering_id TEXT NOT NULL REFERENCES gatherings(id) ON DELETE CASCADE,
 player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
 status TEXT NOT NULL CHECK(status IN ('yes','no','maybe')),
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(gathering_id, player_id)
);
CREATE TABLE IF NOT EXISTS matches (
 id TEXT PRIMARY KEY, gathering_id TEXT NOT NULL REFERENCES gatherings(id) ON DELETE CASCADE,
 match_no INTEGER NOT NULL DEFAULT 1, title TEXT NOT NULL DEFAULT '경기',
 team_a TEXT NOT NULL DEFAULT 'A팀', team_b TEXT NOT NULL DEFAULT 'B팀',
 score_a INTEGER NOT NULL DEFAULT 0, score_b INTEGER NOT NULL DEFAULT 0,
 status TEXT NOT NULL DEFAULT 'planned' CHECK(status IN ('planned','completed')),
 mvp_player_id TEXT, note TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_matches_gathering ON matches(gathering_id, match_no);
CREATE TABLE IF NOT EXISTS team_assignments (
 id TEXT PRIMARY KEY, match_id TEXT NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
 player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
 team_name TEXT NOT NULL, source TEXT NOT NULL DEFAULT 'final',
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(match_id, player_id)
);
CREATE INDEX IF NOT EXISTS idx_assignments_player ON team_assignments(player_id);
CREATE TABLE IF NOT EXISTS match_players (
 id TEXT PRIMARY KEY, match_id TEXT NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
 player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
 team_name TEXT NOT NULL, played_minutes INTEGER NOT NULL DEFAULT 0,
 goals INTEGER NOT NULL DEFAULT 0, assists INTEGER NOT NULL DEFAULT 0,
 UNIQUE(match_id, player_id)
);
CREATE TABLE IF NOT EXISTS seasons (
 id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE, starts_on TEXT NOT NULL, ends_on TEXT NOT NULL,
 is_active INTEGER NOT NULL DEFAULT 0
);
INSERT OR IGNORE INTO seasons (id,name,starts_on,ends_on,is_active) VALUES ('season-2026','2026','2026-01-01','2026-12-31',1);
