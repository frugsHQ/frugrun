DROP POLICY IF EXISTS "Anyone can insert scores" ON public.leaderboard;
DROP POLICY IF EXISTS "Anyone can update scores" ON public.leaderboard;
REVOKE INSERT, UPDATE, DELETE ON public.leaderboard FROM anon, authenticated;
GRANT SELECT ON public.leaderboard TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.submit_score(_name text, _score integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n text := btrim(coalesce(_name, ''));
  existing_id uuid;
  existing_score integer;
BEGIN
  IF n = '' OR char_length(n) > 16 THEN
    RAISE EXCEPTION 'Invalid name';
  END IF;
  IF _score IS NULL OR _score < 0 OR _score > 10000000 THEN
    RAISE EXCEPTION 'Invalid score';
  END IF;
  SELECT id, score INTO existing_id, existing_score
    FROM public.leaderboard WHERE player_name = n LIMIT 1;
  IF existing_id IS NULL THEN
    INSERT INTO public.leaderboard (player_name, score) VALUES (n, _score);
  ELSIF _score > existing_score THEN
    UPDATE public.leaderboard SET score = _score, created_at = now() WHERE id = existing_id;
  END IF;
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_score(text, integer) FROM public;
GRANT EXECUTE ON FUNCTION public.submit_score(text, integer) TO anon, authenticated;