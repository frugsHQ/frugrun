// ── Leaderboard data helpers ───────────────────────────────
// Keeps leaderboard logic separate from gameplay.

import { supabase } from "@/integrations/supabase/client";

export interface LeaderboardEntry {
  id: string;
  player_name: string;
  score: number;
  created_at: string;
}

/** Fetch top 10 scores, highest first */
export async function fetchLeaderboard(): Promise<LeaderboardEntry[]> {
  const { data, error } = await supabase
    .from("leaderboard")
    .select("*")
    .order("score", { ascending: false })
    .limit(10);

  if (error) {
    console.error("Failed to fetch leaderboard:", error.message);
    return [];
  }
  return data ?? [];
}

/** Save a score. Returns true on success. */
export async function saveScore(playerName: string, score: number): Promise<boolean> {
  const trimmed = playerName.trim().slice(0, 10);
  if (!trimmed) return false;

  const { error } = await supabase
    .from("leaderboard")
    .insert({ player_name: trimmed, score });

  if (error) {
    console.error("Failed to save score:", error.message);
    return false;
  }
  return true;
}
