-- Add role column to match_participants (needed for five-stack role variant tracking)
ALTER TABLE match_participants ADD COLUMN IF NOT EXISTS role VARCHAR(16);

-- Duo stats: find frequent teammates for a given player.
-- Supports all-time (season_filter = NULL) and per-season filtering.
-- Only returns partners with >= min_games games together.
CREATE OR REPLACE FUNCTION get_duo_stats(
  target_puuid TEXT,
  min_games INT DEFAULT 2,
  season_filter TEXT DEFAULT NULL
)
RETURNS TABLE(
  partner_id VARCHAR(78),
  partner_name VARCHAR(16),
  games_together BIGINT,
  wins_together BIGINT
)
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT
    mp2.player_id AS partner_id,
    MAX(mp2.game_name)::VARCHAR(16) AS partner_name,
    COUNT(*)::BIGINT AS games_together,
    COUNT(*) FILTER (WHERE mp2.win)::BIGINT AS wins_together
  FROM match_participants mp1
  JOIN match_participants mp2
    ON mp1.match_id = mp2.match_id
    AND mp1.team = mp2.team
    AND mp1.player_id != mp2.player_id
  JOIN matches m
    ON m.match_id = mp1.match_id
    AND m.player_id = target_puuid
  WHERE mp1.player_id = target_puuid
    AND (season_filter IS NULL OR ('S' || EXTRACT(YEAR FROM m.match_timestamp)::TEXT) = season_filter)
  GROUP BY mp2.player_id
  HAVING COUNT(*) >= min_games
  ORDER BY games_together DESC
  LIMIT 20;
END;
$$;

-- Five-stack detection: find groups of 5 players that appeared on the same team
-- across multiple matches (excluding Solo/Duo queue where five-stacking is impossible).
-- Returns one row per unique stack group with game count and win count.
CREATE OR REPLACE FUNCTION get_fivestack_groups(
  target_puuid TEXT,
  min_games INT DEFAULT 2,
  season_filter TEXT DEFAULT NULL
)
RETURNS TABLE(
  teammate_ids TEXT,
  teammate_names TEXT,
  games_together BIGINT,
  wins_together BIGINT
)
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  WITH my_matches AS (
    SELECT mp.match_id, mp.team
    FROM match_participants mp
    JOIN matches m
      ON m.match_id = mp.match_id
      AND m.player_id = target_puuid
    WHERE mp.player_id = target_puuid
      AND m.queue_type != 'RANKED_SOLO_5x5'
      AND (season_filter IS NULL OR ('S' || EXTRACT(YEAR FROM m.match_timestamp)::TEXT) = season_filter)
  ),
  full_teams AS (
    SELECT
      mm.match_id,
      array_to_string(
        ARRAY(
          SELECT mp2.player_id
          FROM match_participants mp2
          WHERE mp2.match_id = mm.match_id AND mp2.team = mm.team
          ORDER BY mp2.player_id
        ), ','
      ) AS sorted_ids,
      array_to_string(
        ARRAY(
          SELECT mp2.game_name
          FROM match_participants mp2
          WHERE mp2.match_id = mm.match_id AND mp2.team = mm.team
          ORDER BY mp2.player_id
        ), ','
      ) AS sorted_names,
      (SELECT bool_and(mp2.win)
       FROM match_participants mp2
       WHERE mp2.match_id = mm.match_id AND mp2.team = mm.team
      ) AS team_won
    FROM my_matches mm
  ),
  five_only AS (
    SELECT * FROM full_teams
    WHERE array_length(string_to_array(sorted_ids, ','), 1) = 5
  )
  SELECT
    sorted_ids AS teammate_ids,
    MAX(sorted_names)::TEXT AS teammate_names,
    COUNT(*)::BIGINT AS games_together,
    COUNT(*) FILTER (WHERE team_won)::BIGINT AS wins_together
  FROM five_only
  GROUP BY sorted_ids
  HAVING COUNT(*) >= min_games
  ORDER BY games_together DESC
  LIMIT 10;
END;
$$;
