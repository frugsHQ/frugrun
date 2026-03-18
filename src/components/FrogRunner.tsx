import { useRef, useEffect, useCallback, useState } from "react";
import frugSprite from "@/assets/frug-sprite.png";
import bgMusicSrc from "@/assets/bg-music.mp3";

// ── Modular imports ────────────────────────────────────────
import {
  GROUND_RATIO, FROG_W_RATIO, FROG_ASPECT,
  GRAVITY, JUMP_VEL, DIFFICULTY,
} from "./game/constants";
import type { ObstacleKind } from "./game/constants";
import type { ParallaxLine, DustParticle, Obstacle, GameState } from "./game/types";
import { initParallaxLines, drawFrogFallback, drawObstacle, drawGround, drawSky, drawClouds, drawParallax } from "./game/drawing";
import { playSfxJump, playSfxScore, playSfxGameOver } from "./game/sfx";
import { StartOverlay, GameOverOverlay } from "./game/overlays";

// ── Component ──────────────────────────────────────────────
export default function FrogRunner() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const spriteRef = useRef<HTMLImageElement | null>(null);
  const spriteLoadedRef = useRef(false);
  const parallaxRef = useRef<ParallaxLine[]>([]);
  const dustRef = useRef<DustParticle[]>([]);
  const shakeRef = useRef(0);

  // ── Audio refs ──
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fadeRef = useRef<number>(0);
  const mutedRef = useRef(localStorage.getItem("frogMuted") === "1");
  const [muted, setMuted] = useState(mutedRef.current);

  useEffect(() => {
    const audio = new Audio(bgMusicSrc);
    audio.loop = true;
    audio.volume = 0;
    audioRef.current = audio;
    return () => { audio.pause(); audio.src = ""; };
  }, []);

  const fadeAudioIn = useCallback(() => {
    cancelAnimationFrame(fadeRef.current);
    const audio = audioRef.current;
    if (!audio || mutedRef.current) return;
    audio.volume = 0;
    audio.play().catch(() => {});
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min((now - start) / 1000, 1);
      audio.volume = t * 0.4;
      if (t < 1) fadeRef.current = requestAnimationFrame(tick);
    };
    fadeRef.current = requestAnimationFrame(tick);
  }, []);

  const fadeAudioOut = useCallback(() => {
    cancelAnimationFrame(fadeRef.current);
    const audio = audioRef.current;
    if (!audio) return;
    const startVol = audio.volume;
    if (startVol === 0) { audio.pause(); return; }
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min((now - start) / 1000, 1);
      audio.volume = startVol * (1 - t);
      if (t < 1) fadeRef.current = requestAnimationFrame(tick);
      else audio.pause();
    };
    fadeRef.current = requestAnimationFrame(tick);
  }, []);

  const toggleMute = useCallback(() => {
    const next = !mutedRef.current;
    mutedRef.current = next;
    localStorage.setItem("frogMuted", next ? "1" : "0");
    const audio = audioRef.current;
    if (audio) {
      if (next) { audio.pause(); }
      else if (stateRef.current.gameState === "playing") {
        audio.volume = 0.4;
        audio.play().catch(() => {});
      }
    }
    setMuted(next);
  }, []);

  // ── Core game state (ref to avoid re-renders during loop) ──
  const stateRef = useRef<{
    gameState: GameState;
    score: number;
    frogY: number;
    frogVY: number;
    onGround: boolean;
    wasOnGround: boolean;
    squashTimer: number;
    obstacles: Obstacle[];
    bestScore: number;
    elapsed: number;       // total elapsed ms — drives difficulty ramp
    spawnTimer: number;
    nextSpawn: number;
    lastTime: number;
    animId: number;
    canvasW: number;
    canvasH: number;
  }>({
    gameState: "start",
    score: 0,
    frogY: 0,
    frogVY: 0,
    onGround: true,
    wasOnGround: true,
    squashTimer: 0,
    obstacles: [],
    bestScore: parseInt(localStorage.getItem("frogBest") || "0", 10),
    elapsed: 0,
    spawnTimer: 0,
    nextSpawn: DIFFICULTY.startMaxSpawn,
    lastTime: 0,
    animId: 0,
    canvasW: 0,
    canvasH: 0,
  });

  // ── React-side state for overlays ──
  const [overlay, setOverlay] = useState<GameState>("start");
  const [displayScore, setDisplayScore] = useState(0);
  const [displayBest, setDisplayBest] = useState(
    parseInt(localStorage.getItem("frogBest") || "0", 10),
  );

  // ── Load sprite once ──
  useEffect(() => {
    const img = new Image();
    img.src = frugSprite;
    img.onload = () => { spriteLoadedRef.current = true; };
    spriteRef.current = img;
  }, []);

  // ── Resize canvas ──
  const resize = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    const ctx = canvas.getContext("2d");
    ctx?.scale(dpr, dpr);
    stateRef.current.canvasW = w;
    stateRef.current.canvasH = h;
    parallaxRef.current = initParallaxLines(w, h);
  }, []);

  // ── Compute current difficulty from elapsed time ──
  function getDifficulty(elapsed: number) {
    const D = DIFFICULTY;
    // Progress 0→1 clamped at capTime
    const t = Math.min(elapsed / D.capTime, 1);
    return {
      speed: D.startSpeed + (D.maxSpeed - D.startSpeed) * t,
      minSpawn: D.startMinSpawn - (D.startMinSpawn - D.minMinSpawn) * t,
      maxSpawn: D.startMaxSpawn - (D.startMaxSpawn - D.minMaxSpawn) * t,
    };
  }

  // ── Pick a random obstacle kind (snakes become more common over time) ──
  function pickObstacleKind(elapsed: number): ObstacleKind {
    const snakeChance = Math.min(0.45, 0.1 + elapsed / DIFFICULTY.capTime * 0.35);
    return Math.random() < snakeChance ? "snake" : "rock";
  }

  // ── Main game loop ──
  const loop = useCallback((time: number) => {
    const s = stateRef.current;
    const canvas = canvasRef.current;
    if (!canvas || s.gameState !== "playing") return;
    const ctx = canvas.getContext("2d")!;
    const dt = s.lastTime ? Math.min(time - s.lastTime, 50) : 16;
    s.lastTime = time;

    const W = s.canvasW;
    const H = s.canvasH;
    const groundY = H * GROUND_RATIO;
    const frogW = W * FROG_W_RATIO;
    const frogH = frogW * FROG_ASPECT;
    const frogX = W * 0.1;
    const scale = W / 400;

    // ── Difficulty ramp ──
    s.elapsed += dt;
    const diff = getDifficulty(s.elapsed);

    // ── Update frog physics ──
    s.frogVY += GRAVITY * scale * dt;
    s.frogY += s.frogVY * scale * dt;
    const justLanded = !s.onGround;
    if (s.frogY >= groundY - frogH) {
      s.frogY = groundY - frogH;
      s.frogVY = 0;
      s.onGround = true;
      if (justLanded && !s.wasOnGround) {
        s.squashTimer = 100;
        const footY = groundY;
        const footX = frogX + frogW / 2;
        for (let i = 0; i < 6; i++) {
          dustRef.current.push({
            x: footX + (Math.random() - 0.5) * frogW * 0.6,
            y: footY - Math.random() * 4,
            vx: (Math.random() - 0.5) * 0.15 * scale,
            vy: -Math.random() * 0.05 * scale,
            life: 300 + Math.random() * 200,
            maxLife: 300 + Math.random() * 200,
            size: 2 + Math.random() * 3,
          });
        }
      }
    }
    s.wasOnGround = s.onGround;
    if (s.squashTimer > 0) s.squashTimer = Math.max(0, s.squashTimer - dt);

    // ── Update dust particles ──
    for (let i = dustRef.current.length - 1; i >= 0; i--) {
      const p = dustRef.current[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      if (p.life <= 0) dustRef.current.splice(i, 1);
    }

    // ── Obstacle speed & spawning (driven by difficulty ramp) ──
    const speed = diff.speed * scale;
    s.spawnTimer += dt;
    if (s.spawnTimer >= s.nextSpawn) {
      s.spawnTimer = 0;
      s.nextSpawn = diff.minSpawn + Math.random() * (diff.maxSpawn - diff.minSpawn);
      const ow = frogW * (0.5 + Math.random() * 0.5);
      const oh = frogH * (0.6 + Math.random() * 0.7);
      const kind = pickObstacleKind(s.elapsed);
      s.obstacles.push({ x: W + 10, w: ow, h: oh, kind });
    }

    // ── Move obstacles & score ──
    for (let i = s.obstacles.length - 1; i >= 0; i--) {
      s.obstacles[i].x -= speed * dt;
      if (s.obstacles[i].x + s.obstacles[i].w < 0) {
        s.obstacles.splice(i, 1);
        s.score++;
        playSfxScore(mutedRef);
      }
    }

    // ── Collision (AABB, slightly smaller hitbox) ──
    const hitboxShrink = 0.15;
    const frogBox = {
      x: frogX + frogW * hitboxShrink,
      y: s.frogY + frogH * hitboxShrink,
      w: frogW * (1 - hitboxShrink * 2),
      h: frogH * (1 - hitboxShrink * 2),
    };
    for (const ob of s.obstacles) {
      const obBox = { x: ob.x, y: groundY - ob.h, w: ob.w, h: ob.h };
      if (
        frogBox.x < obBox.x + obBox.w &&
        frogBox.x + frogBox.w > obBox.x &&
        frogBox.y < obBox.y + obBox.h &&
        frogBox.y + frogBox.h > obBox.y
      ) {
        s.gameState = "over";
        shakeRef.current = 300;
        playSfxGameOver(mutedRef);
        if (s.score > s.bestScore) {
          s.bestScore = s.score;
          localStorage.setItem("frogBest", String(s.bestScore));
        }
        fadeAudioOut();
        setDisplayScore(s.score);
        setDisplayBest(s.bestScore);
        setOverlay("over");
        return;
      }
    }

    // ── Screen shake offset ──
    let shakeX = 0, shakeY = 0;
    if (shakeRef.current > 0) {
      shakeRef.current = Math.max(0, shakeRef.current - dt);
      const intensity = (shakeRef.current / 300) * 6;
      shakeX = (Math.random() - 0.5) * intensity;
      shakeY = (Math.random() - 0.5) * intensity;
    }

    // ── Draw everything ──
    ctx.save();
    ctx.translate(shakeX, shakeY);
    ctx.clearRect(-10, -10, W + 20, H + 20);
    drawSky(ctx, W, groundY);
    drawParallax(ctx, parallaxRef.current, speed, dt, W);
    drawClouds(ctx, W, s.elapsed);
    drawGround(ctx, W, groundY, H);

    for (const ob of s.obstacles) {
      drawObstacle(ctx, ob.x, groundY, ob.w, ob.h, ob.kind, s.elapsed);
    }

    // ── Ground shadow under frog ──
    const airHeight = groundY - frogH - s.frogY;
    const maxAir = groundY - frogH;
    const shadowScale = Math.max(0.4, 1 - (airHeight / maxAir) * 0.6);
    ctx.save();
    ctx.globalAlpha = 0.2 * shadowScale;
    ctx.fillStyle = "#000";
    ctx.beginPath();
    ctx.ellipse(frogX + frogW / 2, groundY + 2, (frogW / 2) * shadowScale, 4 * shadowScale, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // ── Squash & stretch + tilt ──
    let scaleX = 1, scaleY = 1, rotation = 0;
    if (!s.onGround) {
      scaleX = 0.93;
      scaleY = 1.08;
      rotation = s.frogVY < 0 ? -0.087 : 0.087;
    } else if (s.squashTimer > 0) {
      const t = s.squashTimer / 100;
      scaleX = 1 + 0.1 * t;
      scaleY = 1 - 0.08 * t;
    }

    const drawW = frogW * scaleX;
    const drawH = frogH * scaleY;
    const drawX = frogX + (frogW - drawW) / 2;
    const drawY = s.frogY + frogH - drawH;

    ctx.save();
    ctx.translate(drawX + drawW / 2, drawY + drawH / 2);
    ctx.rotate(rotation);
    if (spriteLoadedRef.current && spriteRef.current) {
      ctx.drawImage(spriteRef.current, -drawW / 2, -drawH / 2, drawW, drawH);
    } else {
      drawFrogFallback(ctx, -drawW / 2, -drawH / 2, drawW, drawH);
    }
    ctx.restore();

    // ── Dust particles ──
    for (const p of dustRef.current) {
      ctx.save();
      ctx.globalAlpha = (p.life / p.maxLife) * 0.4;
      ctx.fillStyle = "#c8b897";
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // ── HUD: score + best + speed indicator ──
    const fontSize = Math.max(16, W * 0.035);
    ctx.font = `bold ${fontSize}px system-ui, sans-serif`;
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.textAlign = "left";
    ctx.fillText(`Score: ${s.score}`, 14, fontSize + 10);
    ctx.textAlign = "right";
    ctx.fillText(`Best: ${s.bestScore}`, W - 14, fontSize + 10);

    // Subtle speed indicator (small bar under score when difficulty > 50%)
    const diffProgress = Math.min(s.elapsed / DIFFICULTY.capTime, 1);
    if (diffProgress > 0.05) {
      const barW = 80;
      const barH = 4;
      const barX = 14;
      const barY = fontSize + 18;
      ctx.fillStyle = "rgba(0,0,0,0.15)";
      ctx.fillRect(barX, barY, barW, barH);
      // Fill color shifts from green → orange → red
      const r = Math.floor(255 * Math.min(diffProgress * 2, 1));
      const g = Math.floor(255 * Math.max(1 - diffProgress * 1.5, 0));
      ctx.fillStyle = `rgb(${r},${g},50)`;
      ctx.fillRect(barX, barY, barW * diffProgress, barH);
    }

    ctx.restore(); // end shake transform
    s.animId = requestAnimationFrame(loop);
  }, [fadeAudioOut]);

  // ── Start / restart the game ──
  const startGame = useCallback(() => {
    const s = stateRef.current;
    const H = s.canvasH;
    const groundY = H * GROUND_RATIO;
    const frogW = s.canvasW * FROG_W_RATIO;
    const frogH = frogW * FROG_ASPECT;

    s.gameState = "playing";
    s.score = 0;
    s.frogY = groundY - frogH;
    s.frogVY = 0;
    s.onGround = true;
    s.wasOnGround = true;
    s.squashTimer = 0;
    s.obstacles = [];
    dustRef.current = [];
    s.elapsed = 0;
    s.spawnTimer = 0;
    s.nextSpawn = DIFFICULTY.startMaxSpawn;
    s.lastTime = 0;
    parallaxRef.current = initParallaxLines(s.canvasW, s.canvasH);
    setOverlay("playing");
    fadeAudioIn();
    cancelAnimationFrame(s.animId);
    s.animId = requestAnimationFrame(loop);
  }, [loop, fadeAudioIn]);

  // ── Jump ──
  const jump = useCallback(() => {
    const s = stateRef.current;
    if (s.gameState === "start") { startGame(); return; }
    if (s.gameState !== "playing") return;
    if (!s.onGround) return;
    const scale = s.canvasW / 400;
    s.frogVY = JUMP_VEL * scale;
    s.onGround = false;
    playSfxJump(mutedRef);

    // Jump dust puff
    const groundY = s.canvasH * GROUND_RATIO;
    const frogW = s.canvasW * FROG_W_RATIO;
    const frogX = s.canvasW * 0.1;
    for (let i = 0; i < 4; i++) {
      dustRef.current.push({
        x: frogX + frogW * (0.2 + Math.random() * 0.6),
        y: groundY - Math.random() * 3,
        vx: (Math.random() - 0.5) * 0.1 * scale,
        vy: -Math.random() * 0.04 * scale,
        life: 200 + Math.random() * 150,
        maxLife: 200 + Math.random() * 150,
        size: 1.5 + Math.random() * 2,
      });
    }
  }, [startGame]);

  // ── Input handlers ──
  useEffect(() => {
    resize();
    window.addEventListener("resize", resize);

    const handleKey = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault();
        jump();
      }
    };
    window.addEventListener("keydown", handleKey);

    return () => {
      window.removeEventListener("resize", resize);
      window.removeEventListener("keydown", handleKey);
      cancelAnimationFrame(stateRef.current.animId);
    };
  }, [resize, jump]);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if ((e.target as HTMLElement).closest?.('[data-ui-button="mute"]')) return;
      e.preventDefault();
      jump();
    },
    [jump],
  );

  // ── Render ──
  return (
    <div className="fixed inset-0 overflow-hidden select-none">
      <canvas
        ref={canvasRef}
        className="block w-full h-full"
        style={{ touchAction: "none" }}
        onPointerDown={handlePointerDown}
      />

      {/* Mute button */}
      <button
        data-ui-button="mute"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleMute(); }}
        onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
        className="absolute right-3 z-20 w-10 h-10 flex items-center justify-center rounded-full bg-black/40 text-white text-xl backdrop-blur-sm hover:bg-black/60 transition-colors"
        style={{ top: "calc(env(safe-area-inset-top, 0px) + 60px)" }}
        aria-label={muted ? "Unmute" : "Mute"}
      >
        {muted ? "🔇" : "🔊"}
      </button>

      {/* ── Overlay screens ── */}
      {overlay === "start" && <StartOverlay onStart={startGame} />}

      {overlay === "over" && (
        <GameOverOverlay
          score={displayScore}
          best={displayBest}
          onRestart={startGame}
        />
      )}
    </div>
  );
}
