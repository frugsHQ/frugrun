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
