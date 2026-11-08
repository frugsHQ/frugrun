// ── Leaderboard data helpers ───────────────────────────────
// Keeps leaderboard logic separate from gameplay.

import { supabase } from "@/integrations/supabase/client";

export const MAX_NAME_LENGTH = 16;

export interface LeaderboardEntry {
  id: string;
  player_name: string;
  score: number;
  created_at: string;
}

/** Fetch top 10 scores, highest first */
export async function fetchLeaderboard(): Promise<LeaderboardEntry[]> {
  console.log("[Leaderboard] Fetching top 10…");
  const { data, error } = await supabase
    .from("leaderboard")
    .select("*")
    .order("score", { ascending: false })
    .limit(10);

  if (error) {
    console.error("[Leaderboard] Fetch failed:", error.message);
    return [];
  }
  console.log("[Leaderboard] Fetched", data?.length ?? 0, "entries");
  return data ?? [];
}

let currentRun: string | null = null;

/** Ask the server for a single-use run ticket when a run begins. */
export async function startRun(): Promise<void> {
  currentRun = null;
  const { data, error } = await supabase.rpc("start_run");
  if (error) { console.error("[Leaderboard] start_run failed:", error.message); return; }
  currentRun = data as string;
}

/** Save a score (one entry per name – keeps highest). Returns true on success. */
export async function saveScore(playerName: string, score: number): Promise<boolean> {
  const trimmed = playerName.trim().slice(0, MAX_NAME_LENGTH);
  if (!trimmed) {
    console.warn("[Leaderboard] Save rejected: empty name after trim");
    return false;
  }
  if (typeof score !== "number" || !isFinite(score) || score < 0) {
    console.warn("[Leaderboard] Save rejected: invalid score", score);
    return false;
  }

  console.log("[Leaderboard] Saving:", { name: trimmed, score });

  // Server validates and keeps only the highest score per name
  const { error } = await currentRun ? supabase.rpc("submit_score", { _run: currentRun, _name: trimmed, _score: Math.floor(score) }) : { error: { message: "No run ticket" } };
  if (!error) currentRun = null;
  if (error) {
    console.error("[Leaderboard] Save failed:", error.message);
    return false;
  }
  console.log("[Leaderboard] Saved");
  return true;
}
