CREATE TABLE public.game_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at timestamptz NOT NULL DEFAULT now(),
  used_at timestamptz
);
GRANT ALL ON public.game_runs TO service_role;
ALTER TABLE public.game_runs ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.start_run()
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE rid uuid;
BEGIN
  DELETE FROM public.game_runs WHERE started_at < now() - interval '1 day';
  INSERT INTO public.game_runs DEFAULT VALUES RETURNING id INTO rid;
  RETURN rid;
END; $$;

DROP FUNCTION IF EXISTS public.submit_score(text, integer);

CREATE OR REPLACE FUNCTION public.submit_score(_run uuid, _name text, _score integer)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  n text := btrim(coalesce(_name, ''));
  run_start timestamptz;
  elapsed numeric;
  existing_id uuid;
  existing_score integer;
BEGIN
  IF n = '' OR char_length(n) > 16 THEN RAISE EXCEPTION 'Invalid name'; END IF;
  IF _score IS NULL OR _score < 0 THEN RAISE EXCEPTION 'Invalid score'; END IF;
  -- Single-use run issued by the server; consume it atomically
  UPDATE public.game_runs SET used_at = now()
    WHERE id = _run AND used_at IS NULL
    RETURNING started_at INTO run_start;
  IF run_start IS NULL THEN RAISE EXCEPTION 'Invalid run'; END IF;
  elapsed := extract(epoch FROM now() - run_start);
  -- Score cannot exceed what is achievable in the server-measured run time
  IF _score > floor(elapsed * 200) + 50 THEN RAISE EXCEPTION 'Implausible score'; END IF;
  SELECT id, score INTO existing_id, existing_score FROM public.leaderboard WHERE player_name = n LIMIT 1;
  IF existing_id IS NULL THEN
    INSERT INTO public.leaderboard (player_name, score) VALUES (n, _score);
  ELSIF _score > existing_score THEN
    UPDATE public.leaderboard SET score = _score, created_at = now() WHERE id = existing_id;
  END IF;
  RETURN true;
END; $$;

REVOKE ALL ON FUNCTION public.start_run() FROM public;
REVOKE ALL ON FUNCTION public.submit_score(uuid, text, integer) FROM public;
GRANT EXECUTE ON FUNCTION public.start_run() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_score(uuid, text, integer) TO anon, authenticated;