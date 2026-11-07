import { Button } from "@/components/ui/button";
import { useState, useEffect, useRef } from "react";
import logoSrc from "@/assets/frugrun-logo.png";
import coinIconSrc from "@/assets/frug-coin.png";
import { fetchLeaderboard, saveScore, MAX_NAME_LENGTH, type LeaderboardEntry } from "./leaderboard";

// ── Shared overlay wrapper with fade-in ────────────────────
function Overlay({ children, bg = "bg-wood-dark/30" }: { children: React.ReactNode; bg?: string }) {
  return (
    <div className={`game-overlay ${bg} z-10 animate-fade-in`} data-ui-button="overlay">
      <div className="game-menu text-center wood-card text-card-foreground">{children}</div>
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

  useEffect(() => {
    fetchLeaderboard().then((entries) => {
      if (entries.length > 0) setTopEntry(entries[0]);
      setLoaded(true);
    });
  }, []);

  return (
    <Overlay>
      <h1 className="mb-2">
        <img src={logoSrc} alt="Frug Run" className="w-full max-w-xs mx-auto drop-shadow-lg" />
      </h1>


      {loaded && (
        <div className="mb-6 text-card-foreground/70 text-sm">
          {topEntry ? (
            <>
              <p className="text-xl text-accent text-outline">🏆 Best Score: {topEntry.score.toLocaleString()}</p>
              <p>By: {topEntry.player_name}</p>
            </>
          ) : (
            <p>No high score yet</p>
          )}
        </div>
      )}

      <div className="flex flex-col gap-3 items-center">
        <Button
          onClick={onStart}
          className="px-8 py-4 bg-primary text-primary-foreground rounded-2xl text-2xl border-4 border-wood-dark shadow-lg hover:scale-105 active:scale-95 transition-transform"
        >
          Tap to Start
        </Button>
        <Button
          onClick={onLeaderboard}
          className="px-6 py-3 bg-secondary text-secondary-foreground rounded-xl text-lg border-4 border-wood-dark hover:brightness-110 active:scale-95 transition-all"
        >
          🏆 Leaderboard
        </Button>
      </div>
    </Overlay>
  );
}

// ── Game over screen with name entry ───────────────────────
export function GameOverOverlay({
  score,
  best,
  combo,
  coins,
  onRestart,
  onMenu,
}: {
  score: number;
  best: number;
  combo: number;
  coins: number;
  onRestart: () => void;
  onMenu: () => void;
}) {
  const [name, setName] = useState(localStorage.getItem("frogName") || "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  // Prevent saving the same run more than once
  const savedRunRef = useRef(false);
  useEffect(() => {
    const viewport = window.visualViewport;
    const resize = () => document.documentElement.style.setProperty('--keyboard-inset', `${Math.max(0, window.innerHeight - (viewport?.height ?? window.innerHeight) - (viewport?.offsetTop ?? 0))}px`);
    viewport?.addEventListener('resize', resize); viewport?.addEventListener('scroll', resize); resize();
    return () => { viewport?.removeEventListener('resize', resize); viewport?.removeEventListener('scroll', resize); document.documentElement.style.setProperty('--keyboard-inset', '0px'); };
  }, []);

  const handleSave = async () => {
    const trimmed = name.trim().slice(0, MAX_NAME_LENGTH);
    // Guard: empty name, already saving, or already saved this run
    if (!trimmed) { setError("Please enter a name."); return; }
    if (saving || saved || savedRunRef.current) return;

    setError("");
    setSaving(true);
    localStorage.setItem("frogName", trimmed);

    const ok = await saveScore(trimmed, score);
    setSaving(false);

    if (ok) {
      savedRunRef.current = true;
      setSaved(true);
    } else {
      setError("Failed to save score. Please try again.");
    }
  };

  return (
    <Overlay bg="bg-wood-dark/50">
      <h2 className="text-4xl sm:text-5xl text-accent text-outline mb-3">
        Game Over
      </h2>
      <p className="text-3xl mb-1">
        Score: <span className="font-bold text-accent">{score}</span>
      </p>
      <p className="flex items-center justify-center gap-2 text-lg mb-1">
        <img src={coinIconSrc} alt="" className="h-6 w-auto" /> {coins} coins
      </p>
      {combo > 1 && (
        <p className="text-sm text-card-foreground/60 mb-1">Peak combo: x{combo.toFixed(1)}</p>
      )}
      <p className="text-lg text-card-foreground/70 mb-5">
        Best: <span className="font-bold">{best}</span>
      </p>

      {/* Name entry */}
      {!saved ? (
        <div className="flex flex-col items-center gap-2 mb-5">
          <input
            type="text"
            maxLength={MAX_NAME_LENGTH}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            aria-label="Your name"
            className="w-52 px-4 py-2 rounded-xl bg-wood-dark/60 text-card-foreground text-center placeholder:text-card-foreground/50 outline-none focus:ring-2 focus:ring-accent border-2 border-wood-dark text-lg"
            onKeyDown={(e) => { if (e.key === "Enter") handleSave(); }}
            disabled={saving}
          />
          {error && <p className="text-destructive text-xs">{error}</p>}
          <Button
            onClick={handleSave}
            disabled={!name.trim() || saving}
            className="px-6 py-2 bg-accent text-accent-foreground rounded-xl text-lg border-4 border-wood-dark shadow hover:scale-105 active:scale-95 transition-transform disabled:opacity-50 disabled:scale-100 disabled:cursor-not-allowed"
          >
            {saving ? "Saving…" : "Save Score"}
          </Button>
        </div>
      ) : (
        <p className="text-sm text-primary mb-5">✅ Score saved!</p>
      )}

      <div className="flex flex-col gap-2 items-center">
        <Button
          onClick={onRestart}
          className="px-8 py-4 bg-primary text-primary-foreground rounded-2xl text-2xl border-4 border-wood-dark shadow-lg hover:scale-105 active:scale-95 transition-transform"
        >
          Play Again
        </Button>
        <Button
          onClick={onMenu}
          className="px-6 py-2 text-card-foreground/70 hover:text-card-foreground text-base transition-colors"
        >
          ← Back to Menu
        </Button>
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
    <Overlay bg="bg-wood-dark/50">
      <h2 className="text-4xl text-accent text-outline mb-4">🏆 Leaderboard</h2>

      {loading ? (
        <p className="text-card-foreground/60">Loading…</p>
      ) : entries.length === 0 ? (
        <p className="text-card-foreground/60 mb-6">No scores yet. Be the first!</p>
      ) : (
        <div className="w-full overflow-hidden rounded-xl bg-wood-dark/50 mb-4 font-sans">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-card-foreground/10 text-card-foreground/50 text-xs uppercase tracking-wider">
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
                  className={`border-b border-card-foreground/5 ${i < 3 ? "text-accent" : "text-card-foreground/80"}`}
                >
                  <td className="px-3 py-2 font-bold">{i + 1}</td>
                  <td className="px-3 py-2 font-medium truncate max-w-[140px]">{e.player_name}</td>
                  <td className="px-3 py-2 text-right font-bold">{e.score.toLocaleString()}</td>
                  <td className="px-3 py-2 text-right text-card-foreground/40 hidden sm:table-cell">
                    {new Date(e.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Button
        onClick={onBack}
        className="px-6 py-3 bg-secondary text-secondary-foreground rounded-xl text-lg border-4 border-wood-dark hover:brightness-110 active:scale-95 transition-all"
      >
        ← Back
      </Button>
    </Overlay>
  );
}
