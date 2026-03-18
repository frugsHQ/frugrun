import { useState, useEffect } from "react";
import { fetchLeaderboard, saveScore, type LeaderboardEntry } from "./leaderboard";

// ── Shared overlay wrapper with fade-in ────────────────────
function Overlay({ children, bg = "bg-black/50" }: { children: React.ReactNode; bg?: string }) {
  return (
    <div className={`absolute inset-0 flex flex-col items-center justify-center ${bg} z-10 animate-fade-in`}>
      <div className="text-center px-6 max-w-md w-full">{children}</div>
    </div>
  );
}

// ── Title / Start screen ───────────────────────────────────
export function StartOverlay({
  onStart,
  onLeaderboard,
}: {
  onStart: () => void;
  onLeaderboard: () => void;
}) {
  const [topEntry, setTopEntry] = useState<{ player_name: string; score: number } | null>(null);
  const [loaded, setLoaded] = useState(false);

  // Fetch the #1 score on mount
  useEffect(() => {
    fetchLeaderboard().then((entries) => {
      if (entries.length > 0) setTopEntry(entries[0]);
      setLoaded(true);
    });
  }, []);

  return (
    <Overlay>
      <h1 className="text-4xl sm:text-5xl font-extrabold text-white mb-2 drop-shadow-lg">
        🐸 Frug Run
      </h1>
      <p className="text-lg text-white/80 mb-4">Tap anywhere or press Space to jump</p>

      {/* Best score from leaderboard */}
      {loaded && (
        <div className="mb-6 text-white/70 text-sm">
          {topEntry ? (
            <>
              <p className="text-base font-bold text-white/90">🏆 Best Score: {topEntry.score.toLocaleString()}</p>
              <p>By: {topEntry.player_name}</p>
            </>
          ) : (
            <p>No high score yet</p>
          )}
        </div>
      )}

      <div className="flex flex-col gap-3 items-center">
        <button
          onClick={onStart}
          className="px-8 py-4 bg-primary text-primary-foreground rounded-2xl text-xl font-bold shadow-lg hover:scale-105 active:scale-95 transition-transform"
        >
          Tap to Start
        </button>
        <button
          onClick={onLeaderboard}
          className="px-6 py-3 bg-white/20 text-white rounded-xl text-base font-semibold backdrop-blur-sm hover:bg-white/30 active:scale-95 transition-all"
        >
          🏆 Leaderboard
        </button>
      </div>
    </Overlay>
  );
}

// ── Game over screen with name entry ───────────────────────
export function GameOverOverlay({
  score,
  best,
  combo,
  onRestart,
  onMenu,
}: {
  score: number;
  best: number;
  combo: number;
  onRestart: () => void;
  onMenu: () => void;
}) {
  const [name, setName] = useState(localStorage.getItem("frogName") || "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    const trimmed = name.trim().slice(0, 10);
    if (!trimmed || saving || saved) return;
    setSaving(true);
    localStorage.setItem("frogName", trimmed);
    const ok = await saveScore(trimmed, score);
    setSaving(false);
    if (ok) setSaved(true);
  };

  return (
    <Overlay bg="bg-black/60">
      <h2 className="text-3xl sm:text-4xl font-extrabold text-white mb-3 drop-shadow-lg">
        Game Over
      </h2>
      <p className="text-2xl text-white mb-1">
        Score: <span className="font-bold text-accent">{score}</span>
      </p>
      {combo > 1 && (
        <p className="text-sm text-white/60 mb-1">Peak combo: x{combo.toFixed(1)}</p>
      )}
      <p className="text-lg text-white/70 mb-5">
        Best: <span className="font-bold">{best}</span>
      </p>

      {/* Name entry */}
      {!saved ? (
        <div className="flex flex-col items-center gap-2 mb-5">
          <input
            type="text"
            maxLength={10}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            className="w-48 px-4 py-2 rounded-xl bg-white/20 text-white text-center placeholder-white/50 outline-none focus:ring-2 focus:ring-primary backdrop-blur-sm text-lg"
            onKeyDown={(e) => { if (e.key === "Enter") handleSave(); }}
            autoFocus
          />
          <button
            onClick={handleSave}
            disabled={!name.trim() || saving}
            className="px-6 py-2 bg-accent text-accent-foreground rounded-xl font-bold shadow hover:scale-105 active:scale-95 transition-transform disabled:opacity-50 disabled:scale-100"
          >
            {saving ? "Saving…" : "Save Score"}
          </button>
        </div>
      ) : (
        <p className="text-sm text-green-300 mb-5">✅ Score saved!</p>
      )}

      <div className="flex flex-col gap-2 items-center">
        <button
          onClick={onRestart}
          className="px-8 py-4 bg-primary text-primary-foreground rounded-2xl text-xl font-bold shadow-lg hover:scale-105 active:scale-95 transition-transform"
        >
          Play Again
        </button>
        <button
          onClick={onMenu}
          className="px-6 py-2 text-white/70 hover:text-white text-sm transition-colors"
        >
          ← Back to Menu
        </button>
      </div>
    </Overlay>
  );
}

// ── Leaderboard screen ─────────────────────────────────────
export function LeaderboardOverlay({ onBack }: { onBack: () => void }) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLeaderboard().then((data) => {
      setEntries(data);
      setLoading(false);
    });
  }, []);

  return (
    <Overlay bg="bg-black/70">
      <h2 className="text-3xl font-extrabold text-white mb-4 drop-shadow-lg">🏆 Leaderboard</h2>

      {loading ? (
        <p className="text-white/60">Loading…</p>
      ) : entries.length === 0 ? (
        <p className="text-white/60 mb-6">No scores yet. Be the first!</p>
      ) : (
        <div className="w-full overflow-hidden rounded-xl bg-white/10 backdrop-blur-sm mb-4">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 text-white/50 text-xs uppercase tracking-wider">
                <th className="px-3 py-2 w-10">#</th>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2 text-right">Score</th>
                <th className="px-3 py-2 text-right hidden sm:table-cell">Date</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e, i) => (
                <tr
                  key={e.id}
                  className={`border-b border-white/5 ${i < 3 ? "text-yellow-300" : "text-white/80"}`}
                >
                  <td className="px-3 py-2 font-bold">{i + 1}</td>
                  <td className="px-3 py-2 font-medium truncate max-w-[120px]">{e.player_name}</td>
                  <td className="px-3 py-2 text-right font-bold">{e.score.toLocaleString()}</td>
                  <td className="px-3 py-2 text-right text-white/40 hidden sm:table-cell">
                    {new Date(e.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <button
        onClick={onBack}
        className="px-6 py-3 bg-white/20 text-white rounded-xl text-base font-semibold backdrop-blur-sm hover:bg-white/30 active:scale-95 transition-all"
      >
        ← Back
      </button>
    </Overlay>
  );
}
