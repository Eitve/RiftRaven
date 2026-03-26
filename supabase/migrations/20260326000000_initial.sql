-- RiftRaven initial schema
-- Sprint 2: run via `supabase db push` after linking to your project

-- ─────────────────────────────────────────────────────────────────────────────
-- profiles: player identity + refresh tracking
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  player_id        VARCHAR(78)   PRIMARY KEY,             -- Riot PUUID (78 chars)
  game_name        VARCHAR(16)   NOT NULL,
  tag_line         VARCHAR(5)    NOT NULL,
  region           VARCHAR(8)    NOT NULL,
  ranked_data      JSONB         NOT NULL DEFAULT '{}',   -- { queueType: { tier, rank, lp } }
  last_compiled_at TIMESTAMPTZ,                           -- NULL = never compiled
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profiles_game_name ON profiles (LOWER(game_name));
CREATE INDEX IF NOT EXISTS idx_profiles_region    ON profiles (region);

-- ─────────────────────────────────────────────────────────────────────────────
-- matches: selectively raw match data per player
-- Stored raw to enable future duo stats + five-stack detection without API re-fetch
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS matches (
  match_id         VARCHAR(32)   NOT NULL,
  player_id        VARCHAR(78)   NOT NULL REFERENCES profiles (player_id) ON DELETE CASCADE,
  match_timestamp  TIMESTAMPTZ   NOT NULL,               -- used for incremental updates
  game_duration    INTEGER       NOT NULL,               -- seconds
  queue_type       VARCHAR(32)   NOT NULL,               -- e.g. RANKED_SOLO_5x5
  champion_id      INTEGER       NOT NULL,
  role             VARCHAR(16)   NOT NULL,               -- JUNGLE, SUPPORT, etc.
  win              BOOLEAN       NOT NULL,
  kills            SMALLINT      NOT NULL,
  deaths           SMALLINT      NOT NULL,
  assists          SMALLINT      NOT NULL,
  PRIMARY KEY (match_id, player_id)
);

CREATE INDEX IF NOT EXISTS idx_matches_player_ts ON matches (player_id, match_timestamp DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- match_participants: all 10 players per match
-- Required for duo statistics + five-stack detection (Should Have features)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS match_participants (
  match_id         VARCHAR(32)   NOT NULL,
  player_id        VARCHAR(78)   NOT NULL,               -- participant PUUID
  game_name        VARCHAR(16)   NOT NULL,               -- display name at match time
  champion_id      INTEGER       NOT NULL,
  team             SMALLINT      NOT NULL,               -- 100 = blue, 200 = red
  win              BOOLEAN       NOT NULL,
  kills            SMALLINT      NOT NULL,
  deaths           SMALLINT      NOT NULL,
  assists          SMALLINT      NOT NULL,
  PRIMARY KEY (match_id, player_id)
);

CREATE INDEX IF NOT EXISTS idx_participants_player ON match_participants (player_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- analytics_cache: pre-calculated aggregate stats
-- Composite PK ensures one cache entry per player × season × queue type
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS analytics_cache (
  player_id         VARCHAR(78)   NOT NULL REFERENCES profiles (player_id) ON DELETE CASCADE,
  season            VARCHAR(16)   NOT NULL,
  queue_type        VARCHAR(32)   NOT NULL,
  total_games       INTEGER       NOT NULL DEFAULT 0,
  wins              INTEGER       NOT NULL DEFAULT 0,
  champion_stats    JSONB         NOT NULL DEFAULT '{}', -- { champion_id: { games, wins, kills, deaths, assists } }
  role_distribution JSONB         NOT NULL DEFAULT '{}', -- { role: games }
  updated_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  PRIMARY KEY (player_id, season, queue_type)
);
