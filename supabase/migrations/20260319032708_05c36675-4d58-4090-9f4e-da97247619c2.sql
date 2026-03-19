-- Allow public updates so anonymous players can update their own best score
CREATE POLICY "Anyone can update scores"
  ON public.leaderboard
  FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);