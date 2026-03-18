import type { LevelDef } from "./types";

// ── Shared overlay wrapper with fade-in ────────────────────
function Overlay({ children, bg = "bg-black/50" }: { children: React.ReactNode; bg?: string }) {
  return (
    <div className={`absolute inset-0 flex flex-col items-center justify-center ${bg} z-10 animate-fade-in`}>
      <div className="text-center px-6">{children}</div>
    </div>
  );
}

// ── Title / Start screen ───────────────────────────────────
export function StartOverlay({ onStart }: { onStart: () => void }) {
  return (
    <Overlay>
      <h1 className="text-4xl sm:text-5xl font-extrabold text-white mb-2 drop-shadow-lg">
        🐸 Frug Run
      </h1>
      <p className="text-lg text-white/80 mb-8">Tap anywhere or press Space to jump</p>
      <button
        onClick={onStart}
        className="px-8 py-4 bg-primary text-primary-foreground rounded-2xl text-xl font-bold shadow-lg hover:scale-105 active:scale-95 transition-transform"
      >
        Tap to Start
      </button>
    </Overlay>
  );
}

// ── Level intro screen ─────────────────────────────────────
export function LevelStartOverlay({
  level,
  onContinue,
}: {
  level: LevelDef;
  onContinue: () => void;
}) {
  return (
    <Overlay bg="bg-black/60">
      <p className="text-sm uppercase tracking-widest text-white/60 mb-2">Level {level.level}</p>
      <h2 className="text-3xl sm:text-4xl font-extrabold text-white mb-2 drop-shadow-lg">
        {level.title}
      </h2>
      <p className="text-base text-white/70 mb-8 max-w-xs mx-auto">{level.subtitle}</p>
      <button
        onClick={onContinue}
        className="px-8 py-4 bg-primary text-primary-foreground rounded-2xl text-xl font-bold shadow-lg hover:scale-105 active:scale-95 transition-transform"
      >
        Start Level
      </button>
    </Overlay>
  );
}

// ── Level complete screen ──────────────────────────────────
export function LevelCompleteOverlay({
  level,
  score,
  totalScore,
  nextLevel,
  onContinue,
}: {
  level: number;
  score: number;
  totalScore: number;
  nextLevel: number;
  onContinue: () => void;
}) {
  return (
    <Overlay bg="bg-black/60">
      <p className="text-sm uppercase tracking-widest text-accent mb-1">✨ Level Complete ✨</p>
      <h2 className="text-3xl sm:text-4xl font-extrabold text-white mb-4 drop-shadow-lg">
        Level {level} Cleared!
      </h2>
      <p className="text-xl text-white mb-1">
        Level Score: <span className="font-bold text-accent">{score}</span>
      </p>
      <p className="text-base text-white/60 mb-6">
        Total: <span className="font-bold">{totalScore}</span>
      </p>
      <p className="text-sm text-white/50 mb-4">Next up: Level {nextLevel}</p>
      <button
        onClick={onContinue}
        className="px-8 py-4 bg-primary text-primary-foreground rounded-2xl text-xl font-bold shadow-lg hover:scale-105 active:scale-95 transition-transform"
      >
        Continue
      </button>
    </Overlay>
  );
}

// ── Game over screen ───────────────────────────────────────
export function GameOverOverlay({
  score,
  best,
  onRestart,
}: {
  score: number;
  best: number;
  onRestart: () => void;
}) {
  return (
    <Overlay bg="bg-black/60">
      <h2 className="text-3xl sm:text-4xl font-extrabold text-white mb-4 drop-shadow-lg">
        Game Over
      </h2>
      <p className="text-2xl text-white mb-1">
        Score: <span className="font-bold text-accent">{score}</span>
      </p>
      <p className="text-lg text-white/70 mb-8">
        Best: <span className="font-bold">{best}</span>
      </p>
      <button
        onClick={onRestart}
        className="px-8 py-4 bg-primary text-primary-foreground rounded-2xl text-xl font-bold shadow-lg hover:scale-105 active:scale-95 transition-transform"
      >
        Restart
      </button>
    </Overlay>
  );
}

// ── Victory screen (after level 5) ─────────────────────────
export function VictoryOverlay({
  totalScore,
  best,
  onPlayAgain,
}: {
  totalScore: number;
  best: number;
  onPlayAgain: () => void;
}) {
  return (
    <Overlay bg="bg-black/70">
      <p className="text-5xl mb-2">🏆</p>
      <h2 className="text-3xl sm:text-4xl font-extrabold text-white mb-2 drop-shadow-lg">
        You Beat Frug Run!
      </h2>
      <p className="text-xl text-white mb-1">
        Final Score: <span className="font-bold text-accent">{totalScore}</span>
      </p>
      <p className="text-base text-white/60 mb-8">
        Best: <span className="font-bold">{best}</span>
      </p>
      <button
        onClick={onPlayAgain}
        className="px-8 py-4 bg-primary text-primary-foreground rounded-2xl text-xl font-bold shadow-lg hover:scale-105 active:scale-95 transition-transform"
      >
        Play Again
      </button>
    </Overlay>
  );
}
