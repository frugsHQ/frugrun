-- Add unique constraint on player_name to enforce one entry per player
ALTER TABLE public.leaderboard ADD CONSTRAINT leaderboard_player_name_unique UNIQUE (player_name);