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

/** Save a score. Returns true on success. */
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

  const { error } = await supabase
    .from("leaderboard")
    .insert({ player_name: trimmed, score });

  if (error) {
    console.error("[Leaderboard] Save failed:", error.message);
    return false;
  }
  console.log("[Leaderboard] Save success");
  return true;
}
