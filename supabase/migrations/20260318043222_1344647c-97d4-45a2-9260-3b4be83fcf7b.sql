
-- Public leaderboard: no auth required, anyone can read and insert
CREATE TABLE public.leaderboard (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  player_name TEXT NOT NULL CHECK (char_length(trim(player_name)) > 0 AND char_length(player_name) <= 10),
  score INTEGER NOT NULL CHECK (score >= 0),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.leaderboard ENABLE ROW LEVEL SECURITY;

-- Anyone can read the leaderboard
CREATE POLICY "Anyone can view leaderboard"
  ON public.leaderboard FOR SELECT
  USING (true);

-- Anyone can insert scores (public game, no auth)
CREATE POLICY "Anyone can insert scores"
  ON public.leaderboard FOR INSERT
  WITH CHECK (true);

-- Index for fast top-10 queries
CREATE INDEX idx_leaderboard_score ON public.leaderboard (score DESC);
