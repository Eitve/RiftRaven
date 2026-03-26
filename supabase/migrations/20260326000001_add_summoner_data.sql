-- Add summoner display data fetched from Riot Summoner v4 API
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS profile_icon_id INTEGER;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS summoner_level  INTEGER;
