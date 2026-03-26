-- Backfill tracking columns for progressive match history loading.
-- history_cursor: epoch seconds of the oldest match fetched so far (NULL = not started)
-- history_complete: true when Riot API returns no more match IDs

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS history_cursor BIGINT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS history_complete BOOLEAN NOT NULL DEFAULT FALSE;
