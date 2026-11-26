-- Dedicated test database only. No production participant data.
CREATE TABLE IF NOT EXISTS leagues (
 id INTEGER PRIMARY KEY, name TEXT NOT NULL, season INTEGER NOT NULL,
 start_round INTEGER NOT NULL CHECK(start_round BETWEEN 1 AND 38),
 end_round INTEGER NOT NULL CHECK(end_round BETWEEN start_round AND 38),
 knockout_start INTEGER NOT NULL CHECK(knockout_start > start_round AND knockout_start <= end_round),
 knockout_size INTEGER NOT NULL CHECK(knockout_size IN (2,4,8,16,32))
);
CREATE TABLE IF NOT EXISTS teams (
 id INTEGER PRIMARY KEY, league_id INTEGER NOT NULL REFERENCES leagues(id),
 name TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('pending','approved','rejected')),
 UNIQUE(league_id,id), UNIQUE(league_id,name)
);
CREATE TABLE IF NOT EXISTS scores (
 league_id INTEGER NOT NULL, team_id INTEGER NOT NULL,
 round INTEGER NOT NULL CHECK(round BETWEEN 1 AND 38),
 points INTEGER NOT NULL CHECK(points BETWEEN -100000 AND 100000),
 PRIMARY KEY(league_id,team_id,round),
 FOREIGN KEY(league_id,team_id) REFERENCES teams(league_id,id)
);
CREATE TABLE IF NOT EXISTS audit (
 id INTEGER PRIMARY KEY, league_id INTEGER NOT NULL REFERENCES leagues(id),
 team_id INTEGER NOT NULL, round INTEGER NOT NULL, points INTEGER NOT NULL,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(league_id,team_id) REFERENCES teams(league_id,id)
);
INSERT OR IGNORE INTO leagues VALUES(1,'Pernas de Pau • Liga piloto',2027,20,38,30,16);
INSERT OR IGNORE INTO teams(id,league_id,name,status) VALUES
(1,1,'Atlético Aurora','approved'),(2,1,'Furacão FC','approved'),(3,1,'Vila United','approved'),(4,1,'Estrela FC','approved'),
(5,1,'Real Zona Sul','approved'),(6,1,'Tricolor 27','approved'),(7,1,'Bola na Rede','approved'),(8,1,'Canarinho FC','approved'),
(9,1,'Arena City','approved'),(10,1,'Alvorada','approved'),(11,1,'União FC','approved'),(12,1,'Guerreiros','approved'),
(13,1,'Império FC','approved'),(14,1,'Fênix','approved'),(15,1,'Nova Geração','approved'),(16,1,'Raça FC','approved');
WITH RECURSIVE rounds(r) AS (SELECT 20 UNION ALL SELECT r+1 FROM rounds WHERE r<32)
INSERT OR IGNORE INTO scores(league_id,team_id,round,points)
 SELECT 1,id,r,4200+(((id-1)*1379+r*719+(id-1)*r*53)%6900)
 FROM teams CROSS JOIN rounds WHERE league_id=1 AND id BETWEEN 1 AND 16;
